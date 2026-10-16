"""Authenticated transient endpoints; no database writes or resume payload logs."""
import asyncio
import logging
import time
from starlette.responses import JSONResponse
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.routing import APIRoute
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool
from app.db.session import get_db
from app.services.auth import get_current_user
from app.schemas.resume import GenerateRequest, GenerateResponse, RecommendRequest, RecommendResponse, RenderRequest, AssistRequest, AssistResponse
from app.services.resume import resume_provider, generate_resume, recommend_courses, provider_description
from app.services.resume_errors import ResumeProblem, GenerationFailure, error_body
from app.services.model_overrides import ModelOverrideError
from app.services.resume_assistant import assist_resume_async, assistant_provider_failure
from app.services.ai_gateway import AIProviderError
from app.services.resume_render import render_pdf, InvalidResume, RenderBusy, RenderFailed

logger = logging.getLogger(__name__)

class PrivateRoute(APIRoute):
    def get_route_handler(self):
        original = super().get_route_handler()
        async def handler(request: Request):
            if request.method == "POST":
                body = bytearray()
                async for chunk in request.stream():
                    if len(body) + len(chunk) > 1_000_000:
                        raise HTTPException(413, "Resume request exceeds the size limit.")
                    body.extend(chunk)
                # Preserve Starlette's request-body cache for normal FastAPI parsing.
                # Only a bounded payload is retained; original documents never arrive.
                request._body = bytes(body)
            return await original(request)
        return handler

router = APIRouter(prefix="/resume", tags=["Resume"], route_class=PrivateRoute, dependencies=[Depends(get_current_user)])

def get_resume_provider(request: Request = None):
    # No default_ai_gateway: its fallback chain is inappropriate for resumes.
    try:
        return resume_provider()
    except ModelOverrideError: raise
    except Exception:
        if request is not None and request.url.path.endswith("/resume/assist"):
            from app.core.config import settings
            raise ModelOverrideError("ai_configuration_invalid" if (settings.ai_api_key or "").strip() else "ai_not_configured") from None
        raise HTTPException(503, "Resume AI is not configured. Your local draft is unchanged.") from None

def get_resume_role_loader(db: AsyncSession = Depends(get_db)):
    from app.services.resume_relevance import load_role
    async def load(code):
        return await load_role(db, code)
    return load

def get_resume_course_loader(db: AsyncSession = Depends(get_db)):
    from app.services.resume_learning import load_course_references
    async def load(ids): return await load_course_references(db, ids)
    return load

async def cancellable_resume_call(request, work):
    async def disconnected():
        while True:
            if (await request.receive())["type"] == "http.disconnect": return
    task, disconnect = asyncio.create_task(work), asyncio.create_task(disconnected())
    try:
        done, _ = await asyncio.wait({task, disconnect}, return_when=asyncio.FIRST_COMPLETED)
        if disconnect in done and not task.done(): return Response(status_code=499)
        return await task
    finally:
        for item in (task, disconnect):
            if not item.done(): item.cancel()
        await asyncio.gather(task, disconnect, return_exceptions=True)

from app.schemas.resume_learning import LearningSkillsRequest, LearningSkillsResponse

@router.post("/learning-skills", response_model=LearningSkillsResponse)
async def learning_skills(payload: LearningSkillsRequest, request: Request, provider=Depends(get_resume_provider), course_loader=Depends(get_resume_course_loader)):
    from app.services.resume_learning import identify_learning_skills
    try:
        return await cancellable_resume_call(request, identify_learning_skills(payload.course_ids, provider, course_loader))
    except ResumeProblem as error:
        status = 504 if error.code == "ai_timeout" else 409 if error.code == "course_reference_changed" else 422 if error.code in {"output_limit", "ai_output_invalid"} else 503
        logger.warning("resume_learning_skills_failed code=%s attempts=%s", error.code, error.attempts)
        return JSONResponse(status_code=status, content=error_body(error), headers={"Cache-Control": "no-store"})
    except ModelOverrideError: raise
    except Exception:
        logger.warning("resume_learning_skills_failed code=internal_error")
        return JSONResponse(status_code=500, content={"detail": "Learning skill identification failed. Your skills are unchanged. Try again.", "code": "internal_error", "fields": []}, headers={"Cache-Control": "no-store"})

@router.get("/capabilities")
def capabilities():
    return provider_description()

@router.post("/generate", response_model=GenerateResponse)
async def generate(payload: GenerateRequest, request: Request, provider=Depends(get_resume_provider), role_loader=Depends(get_resume_role_loader), course_loader=Depends(get_resume_course_loader)):
    started = time.monotonic()
    try:
        if payload.source_sections is None:
            return await run_in_threadpool(generate_resume, payload, provider)
        from app.services.resume_generation import generate_reviewed_resume
        async def disconnected():
            # The bounded body has already been consumed by PrivateRoute.
            # Await the ASGI disconnect directly: is_disconnected() uses a
            # cancelled AnyIO scope which can swallow Task.cancel() and leave
            # the response waiting forever during cleanup.
            while True:
                if (await request.receive())["type"] == "http.disconnect": return
        async def generate_with_role():
            from app.services.resume_learning import validate_course_skill_sources
            await validate_course_skill_sources(payload, course_loader)
            role = await role_loader(payload.occupation_code) if payload.occupation_code is not None else None
            return await generate_reviewed_resume(payload, provider, role)
        generation = asyncio.create_task(generate_with_role())
        disconnect = asyncio.create_task(disconnected())
        try:
            done, _ = await asyncio.wait({generation, disconnect}, return_when=asyncio.FIRST_COMPLETED)
            if disconnect in done and not generation.done():
                logger.info("resume_polish_cancelled code=client_disconnected")
                return Response(status_code=499)
            return await generation
        finally:
            for task in (generation, disconnect):
                if not task.done(): task.cancel()
            await asyncio.gather(generation, disconnect, return_exceptions=True)
    except ResumeProblem as error:
        logger.warning("resume_generate_failed code=%s attempts=%s status=503 duration_ms=%.1f", error.code, error.attempts, (time.monotonic() - started) * 1000)
        body = error_body(error)
        body["detail"] += " Your local input is unchanged. Try again or edit manually." if error.code in {"duplicate_sections", "duplicate_gaps", "missing_evidence", "invalid_reference", "unsupported_fact", "unsupported_claim", "unverified_name", "unsafe_content"} else ""
        status = 404 if error.code == "target_role_not_found" else 409 if error.code in {"target_role_changed", "course_reference_changed"} else 422 if error.code in {"role_has_no_skills", "no_related_input"} else 503
        return JSONResponse(status_code=status, content=body, headers={"Cache-Control": "no-store"})
    except ModelOverrideError: raise
    except Exception:
        logger.warning("resume_generate_failed code=internal_error attempts=0 status=503 duration_ms=%.1f", (time.monotonic() - started) * 1000)
        return JSONResponse(status_code=503, content={"detail": "AI could not generate a supported draft. Your local input is unchanged. Try again or edit manually.", "code": "internal_error", "fields": []}, headers={"Cache-Control": "no-store"})

@router.post("/assist", response_model=AssistResponse)
async def assist(payload: AssistRequest, request: Request, provider=Depends(get_resume_provider)):
    started = time.monotonic()
    try:
        async def disconnected():
            # PrivateRoute already consumed the body; directly await disconnect.
            # Avoid is_disconnected()'s AnyIO cancel scope swallowing Task.cancel.
            while True:
                if (await request.receive())["type"] == "http.disconnect": return
        editing = asyncio.create_task(assist_resume_async(payload, provider))
        disconnect = asyncio.create_task(disconnected())
        try:
            done, _ = await asyncio.wait({editing, disconnect}, return_when=asyncio.FIRST_COMPLETED)
            if disconnect in done:
                logger.info("resume_assist_disconnected code=client_disconnected")
                return Response(status_code=499)
            return await editing
        finally:
            for task in (editing, disconnect):
                if not task.done(): task.cancel()
            await asyncio.gather(editing, disconnect, return_exceptions=True)
    except ResumeProblem as error:
        status = 422 if isinstance(error, InvalidResume) else 504 if error.code == "ai_timeout" else 422 if error.code in {"ai_output_invalid", "invalid_reference", "unsupported_fact", "unsupported_claim", "unverified_name", "missing_evidence", "unsafe_content", "output_limit", "duplicate_sections"} else 503
        logger.warning("resume_assist_failed code=%s attempts=%s status=%s duration_ms=%.1f", error.code, error.attempts, status, (time.monotonic() - started) * 1000)
        body = error_body(error)
        if status == 422 and not isinstance(error, InvalidResume) and error.code != "ai_output_invalid":
            body["detail"] = "AI editing returned changes that failed safety checks. Your resume is unchanged. Try a more specific instruction."
        return JSONResponse(status_code=status, content=body, headers={"Cache-Control": "no-store"})
    except ModelOverrideError as error:
        failure = assistant_provider_failure(error)
        return JSONResponse(status_code=503, content=error_body(failure), headers={"Cache-Control": "no-store"})
    except Exception:
        logger.warning("resume_assist_failed code=internal_error attempts=0 status=500 duration_ms=%.1f", (time.monotonic() - started) * 1000)
        return JSONResponse(status_code=500, content={"detail": "An internal editing error occurred. Your resume is unchanged. Try again.", "code": "internal_error", "fields": []}, headers={"Cache-Control": "no-store"})

@router.post("/recommend-courses", response_model=RecommendResponse)
async def recommendations(payload: RecommendRequest, db: AsyncSession = Depends(get_db)):
    # Recommendations are optional. A database/provider failure must not block a CV.
    if not payload.gaps:
        return RecommendResponse()
    try:
        rows = (await db.execute(text(
            "SELECT c.course_code, c.title, c.course_description, c.outcomes, s.core_skill "
            "FROM catalogue_courses c JOIN ref_wef_skills s ON s.wef_skill_id=c.skill_id"
        ))).mappings().all()
        return await run_in_threadpool(recommend_courses, payload.gaps, rows, resume_provider())
    except ModelOverrideError:
        # The optional client can ignore failures, but configuration errors must
        # not masquerade as a successful empty recommendation response.
        raise
    except AIProviderError as error:
        detail = "Course recommendations are unavailable. Your resume is unchanged. Try again."
        failure = GenerationFailure(detail, code="ai_output_invalid", attempts=1) if error.kind == "output" else assistant_provider_failure(error, 1)
        failure.detail = detail
        logger.warning("resume_courses_failed code=%s", failure.code)
        return JSONResponse(status_code=504 if failure.code == "ai_timeout" else 503, content=error_body(failure), headers={"Cache-Control": "no-store"})
    except Exception as error:
        logger.warning("resume_courses_unavailable category=%s", type(error).__name__)
        return RecommendResponse()

@router.post("/render")
async def render(payload: RenderRequest):
    started = time.monotonic()
    try:
        data = await run_in_threadpool(render_pdf, payload.document)
    except InvalidResume as error:
        logger.warning("resume_render_rejected code=%s attempts=1 status=422 duration_ms=%.1f", error.code, (time.monotonic() - started) * 1000)
        return JSONResponse(status_code=422, content=error_body(error), headers={"Cache-Control": "no-store"})
    except RenderBusy:
        logger.warning("resume_render_failed code=render_busy attempts=1 status=429 duration_ms=%.1f", (time.monotonic() - started) * 1000)
        return JSONResponse(status_code=429, content={"detail": "The renderer is busy. Try again shortly.", "code": "render_busy", "fields": []}, headers={"Cache-Control": "no-store"})
    except RenderFailed as error:
        code = "render_timeout" if error.code == "render_timeout" else "render_failed"
        detail = "Resume rendering timed out. Your local draft is unchanged." if code == "render_timeout" else "The PDF could not be rendered. Your local draft is unchanged."
        logger.warning("resume_render_failed code=%s attempts=1 status=503 duration_ms=%.1f", code, (time.monotonic() - started) * 1000)
        return JSONResponse(status_code=503, content={"detail": detail, "code": code, "fields": []}, headers={"Cache-Control": "no-store"})
    except Exception:
        logger.warning("resume_render_failed code=internal_error attempts=1 status=500 duration_ms=%.1f", (time.monotonic() - started) * 1000)
        return JSONResponse(status_code=500, content={"detail": "The PDF could not be rendered. Your local draft is unchanged.", "code": "internal_error", "fields": []}, headers={"Cache-Control": "no-store"})
    return Response(data, media_type="application/pdf", headers={"Cache-Control": "no-store", "Content-Disposition": 'inline; filename="resume.pdf"'})
