"""Epic 9 interview practice. Reference lookups and transient AI calls; no personal data is stored."""
import asyncio
import logging
import threading
import time

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.routing import APIRoute
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool
from starlette.responses import JSONResponse

from app.db.session import get_db
from app.routers.resume import get_resume_provider
from app.schemas.interview import FeedbackRequest, FeedbackResponse, PlanRequest, PlanResponse, QuestionBankResponse
from app.services.auth import get_current_user
from app.services.interview import bank_for_occupation, feedback_for_answer, plan_questions, template_plan
from app.services.model_overrides import ModelOverrideError
from app.services.resume_errors import ResumeProblem, error_body
from app.services.interview_transcription import MAX_AUDIO_BYTES, transcribe_audio, transcription_configured, validate_audio

logger = logging.getLogger(__name__)
NO_STORE = {"Cache-Control": "no-store"}
# shortcut: one flight per account in this process; use shared limits across scaled instances.
_TRANSCRIBING = set()
_TRANSCRIPTION_LOCK = threading.Lock()


class PrivateRoute(APIRoute):
    """Bound request size and never keep bodies. Answers and resume items are personal."""

    def get_route_handler(self):
        original = super().get_route_handler()

        async def handler(request: Request):
            if request.method == "POST":
                limit = MAX_AUDIO_BYTES if self.path.endswith("/interview/transcribe") else 200_000
                body = bytearray()
                async for chunk in request.stream():
                    if len(body) + len(chunk) > limit:
                        raise HTTPException(413, "Interview request exceeds the size limit.")
                    body.extend(chunk)
                request._body = bytes(body)
            return await original(request)

        return handler


router = APIRouter(prefix="/interview", tags=["Interview"], route_class=PrivateRoute, dependencies=[Depends(get_current_user)])


@router.get("/transcription-capabilities")
def transcription_capabilities():
    return JSONResponse({"configured": transcription_configured()}, headers=NO_STORE)


@router.post("/transcribe")
async def transcribe(request: Request, user=Depends(get_current_user)):
    audio = await request.body()
    extension, media_type = validate_audio(audio, request.headers.get("content-type", ""))
    with _TRANSCRIPTION_LOCK:
        if user.id in _TRANSCRIBING:
            raise HTTPException(429, "Your recording is already being transcribed. Wait for it to finish.")
        _TRANSCRIBING.add(user.id)
    try:
        async def disconnected():
            # PrivateRoute consumed the body; directly await ASGI disconnect.
            while True:
                if (await request.receive())["type"] == "http.disconnect":
                    return
        transcription = asyncio.create_task(transcribe_audio(audio, extension, media_type))
        disconnect = asyncio.create_task(disconnected())
        try:
            done, _ = await asyncio.wait({transcription, disconnect}, return_when=asyncio.FIRST_COMPLETED)
            if disconnect in done:
                return Response(status_code=499, headers=NO_STORE)
            return JSONResponse({"text": await transcription}, headers=NO_STORE)
        finally:
            for task in (transcription, disconnect):
                if not task.done():
                    task.cancel()
            await asyncio.gather(transcription, disconnect, return_exceptions=True)
    finally:
        with _TRANSCRIPTION_LOCK:
            _TRANSCRIBING.discard(user.id)


def _optional_provider():
    try:
        return get_resume_provider()
    except ModelOverrideError:
        raise
    except HTTPException:
        return None


@router.get("/question-bank", response_model=QuestionBankResponse)
async def question_bank(
    occupation_code: str = Query(min_length=2, max_length=10, pattern=r"^[0-9A-Za-z]+$"),
    limit: int = Query(default=12, ge=1, le=30),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await bank_for_occupation(db, occupation_code, limit)
    except Exception:
        logger.exception("Failed to load the interview question bank")
        raise HTTPException(503, "The question bank is unavailable. You can still practise with your resume.") from None
    return JSONResponse(result.model_dump(), headers={"Cache-Control": "private, max-age=3600"})


@router.post("/plan", response_model=PlanResponse)
async def plan(payload: PlanRequest, provider=Depends(_optional_provider)):
    """Three to five questions. Without AI, simple template questions keep practice available."""
    if provider is None:
        return JSONResponse(template_plan(payload).model_dump(), headers=NO_STORE)
    started = time.monotonic()
    try:
        result = await run_in_threadpool(plan_questions, payload, provider)
    except ResumeProblem as error:
        logger.warning("interview_plan_fallback code=%s duration_ms=%.1f", error.code, (time.monotonic() - started) * 1000)
        result = template_plan(payload)
    except ModelOverrideError:
        raise
    except Exception:
        logger.warning("interview_plan_fallback code=internal_error duration_ms=%.1f", (time.monotonic() - started) * 1000)
        result = template_plan(payload)
    return JSONResponse(result.model_dump(), headers=NO_STORE)


@router.post("/feedback", response_model=FeedbackResponse)
async def feedback(payload: FeedbackRequest, provider=Depends(get_resume_provider)):
    started = time.monotonic()
    try:
        result = await run_in_threadpool(feedback_for_answer, payload, provider)
    except ResumeProblem as error:
        logger.warning("interview_feedback_failed code=%s attempts=%s duration_ms=%.1f", error.code, error.attempts, (time.monotonic() - started) * 1000)
        body = error_body(error)
        body["detail"] += " Your answer is saved. Try again."
        return JSONResponse(status_code=503, content=body, headers=NO_STORE)
    except ModelOverrideError:
        raise
    except Exception:
        logger.warning("interview_feedback_failed code=internal_error duration_ms=%.1f", (time.monotonic() - started) * 1000)
        return JSONResponse(status_code=503, content={"detail": "Feedback could not be prepared. Your answer is saved. Try again.", "code": "internal_error", "fields": []}, headers=NO_STORE)
    return JSONResponse(result.model_dump(), headers=NO_STORE)
