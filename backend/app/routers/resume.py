"""Authenticated transient endpoints; no database writes or resume payload logs."""
import logging
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.routing import APIRoute
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool
from app.db.session import get_db
from app.services.auth import get_current_user
from app.schemas.resume import GenerateRequest, GenerateResponse, RecommendRequest, RecommendResponse, RenderRequest
from app.services.resume import resume_provider, generate_resume, recommend_courses, provider_description
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

def get_resume_provider():
    # No default_ai_gateway: its fallback chain is inappropriate for resumes.
    try:
        return resume_provider()
    except Exception:
        raise HTTPException(503, "Resume AI is not configured. Your local draft is unchanged.") from None

@router.get("/capabilities")
def capabilities():
    return provider_description()

@router.post("/generate", response_model=GenerateResponse)
async def generate(payload: GenerateRequest, provider=Depends(get_resume_provider)):
    try:
        return await run_in_threadpool(generate_resume, payload, provider)
    except Exception as error:
        logger.warning("resume_generate_failed category=%s", type(error).__name__)
        raise HTTPException(503, "AI could not produce a supported, evidence-based draft. Your local input is unchanged. Try again or edit manually.") from None

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
    except Exception as error:
        logger.warning("resume_courses_unavailable category=%s", type(error).__name__)
        return RecommendResponse()

@router.post("/render")
async def render(payload: RenderRequest):
    try:
        data = await run_in_threadpool(render_pdf, payload.document)
    except InvalidResume as error:
        raise HTTPException(422, str(error)) from None
    except RenderBusy:
        raise HTTPException(429, "The renderer is busy. Try again shortly.") from None
    except RenderFailed as error:
        raise HTTPException(503, str(error)) from None
    return Response(data, media_type="application/pdf", headers={"Cache-Control": "no-store", "Content-Disposition": 'inline; filename="resume.pdf"'})
