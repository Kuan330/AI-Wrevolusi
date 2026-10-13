"""Transient audio transcription through a separately configured speech provider."""
import asyncio
import json
from urllib.parse import urlsplit

import httpx
from fastapi import HTTPException

from app.core.config import settings

MAX_AUDIO_BYTES = 3_000_000
MAX_RESPONSE_BYTES = 64_000
TRANSCRIPTION_TIMEOUT = 45


def transcription_configured() -> bool:
    try:
        endpoint = urlsplit(settings.speech_base_url.strip())
    except ValueError:
        return False
    return bool(settings.speech_api_key.strip() and settings.speech_model.strip()
                and endpoint.scheme == "https" and endpoint.hostname
                and not endpoint.username and not endpoint.password
                and not endpoint.query and not endpoint.fragment)


def validate_audio(audio: bytes, content_type: str) -> tuple[str, str]:
    if not audio:
        raise HTTPException(422, "No audio was received. Record your answer again.")
    if len(audio) > MAX_AUDIO_BYTES:
        raise HTTPException(413, "The recording is too large. Record a shorter answer.")
    media_type = content_type.split(";", 1)[0].strip().lower()
    if media_type == "audio/webm":
        extension, valid = "webm", audio.startswith(b"\x1aE\xdf\xa3")
    elif media_type == "audio/ogg":
        extension, valid = "ogg", audio.startswith(b"OggS")
    elif media_type in {"audio/mp4", "audio/m4a", "audio/x-m4a"}:
        extension, valid = "m4a", len(audio) >= 12 and audio[4:8] == b"ftyp"
    elif media_type in {"audio/wav", "audio/x-wav"}:
        extension, valid = "wav", len(audio) >= 12 and audio[:4] == b"RIFF" and audio[8:12] == b"WAVE"
    else:
        raise HTTPException(415, "Use a WebM, Ogg, M4A or WAV audio recording.")
    if not valid:
        raise HTTPException(415, "The recording format could not be read. Record your answer again.")
    return extension, media_type


async def transcribe_audio(audio: bytes, extension: str, media_type: str) -> str:
    if not transcription_configured():
        raise HTTPException(503, "Voice transcription is not configured. You can type your answer.")
    try:
        async with asyncio.timeout(TRANSCRIPTION_TIMEOUT):
            async with httpx.AsyncClient(timeout=TRANSCRIPTION_TIMEOUT, follow_redirects=False) as client:
                async with client.stream(
                    "POST", settings.speech_base_url.strip().rstrip("/") + "/audio/transcriptions",
                    headers={"Authorization": "Bearer " + settings.speech_api_key.strip()},
                    data={"model": settings.speech_model.strip(), "response_format": "json", "language": "en"},
                    files={"file": ("answer." + extension, audio, media_type)},
                ) as response:
                    if response.status_code != 200:
                        raise HTTPException(503, "Voice transcription is unavailable. Try again or type your answer.")
                    body = bytearray()
                    async for chunk in response.aiter_bytes():
                        if len(body) + len(chunk) > MAX_RESPONSE_BYTES:
                            raise HTTPException(503, "The speech service returned an invalid transcript. Try again.")
                        body.extend(chunk)
                    result = json.loads(body)
    except (TimeoutError, httpx.TimeoutException):
        raise HTTPException(504, "Voice transcription timed out. Try again or type your answer.") from None
    except (httpx.HTTPError, ValueError):
        raise HTTPException(503, "Voice transcription is unavailable. Try again or type your answer.") from None
    text = result.get("text") if isinstance(result, dict) else None
    if not isinstance(text, str) or len(text) > 4000:
        raise HTTPException(503, "The speech service returned an invalid transcript. Try again.")
    if not text.strip():
        raise HTTPException(422, "No words were heard. Speak clearly and record your answer again.")
    return text.strip()
