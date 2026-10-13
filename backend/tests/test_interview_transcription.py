"""Synthetic transcription checks; no live providers, credentials or user audio."""
import asyncio
import json
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from starlette.requests import Request

from app.core.config import Settings
from app.main import create_app
from app.routers import interview
from app.services import interview_transcription as speech
from app.services.auth import get_current_user

WAV = b"RIFF" + b"\x20\x00\x00\x00" + b"WAVE" + b"synthetic-audio"
MARKER = "SYNTHETIC-PRIVATE-SPEECH"


@pytest.fixture
def configured(monkeypatch):
    monkeypatch.setattr(speech, "settings", SimpleNamespace(
        speech_api_key="synthetic-speech-key", speech_base_url="https://speech.example.test/v1", speech_model="synthetic-model"))


@pytest.fixture
def client(monkeypatch):
    app = create_app()
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=uuid.UUID(int=1))
    with TestClient(app) as value:
        yield value


def provider(monkeypatch, respond):
    original = httpx.AsyncClient
    transport = httpx.MockTransport(respond)
    monkeypatch.setattr(speech.httpx, "AsyncClient", lambda **kwargs: original(transport=transport, **kwargs))


def test_credentials_are_separate_and_default_empty(monkeypatch):
    for key in ("SPEECH_API_KEY", "SPEECH_BASE_URL", "SPEECH_MODEL"):
        monkeypatch.delenv(key, raising=False)
    config = Settings(_env_file=None, ai_api_key="text-key", skill_llm_api_key="skill-key")
    assert (config.speech_api_key, config.speech_base_url, config.speech_model) == ("", "", "")


@pytest.mark.parametrize("base", ["", "http://speech.example.test/v1", "https://user:password@speech.example.test/v1", "https://speech.example.test/v1?key=private", "https://[invalid"])
def test_invalid_configuration_not_advertised(configured, monkeypatch, base):
    monkeypatch.setattr(speech.settings, "speech_base_url", base)
    assert not speech.transcription_configured()


def test_capabilities_are_private_and_reveal_no_provider(client, configured):
    response = client.get("/api/v1/interview/transcription-capabilities")
    assert response.status_code == 200
    assert response.json() == {"configured": True}
    assert response.headers["cache-control"] == "no-store"
    assert "synthetic" not in response.text


@pytest.mark.parametrize("method,path", [("GET", "/transcription-capabilities"), ("POST", "/transcribe")])
def test_authentication_required(method, path):
    with TestClient(create_app()) as value:
        response = value.request(method, "/api/v1/interview" + path, content=WAV, headers={"Content-Type": "audio/wav"})
    assert response.status_code == 401
    assert response.headers["cache-control"] == "no-store"


@pytest.mark.parametrize("audio,mime,status", [
    (b"", "audio/wav", 422),
    (WAV, "text/plain", 415),
    (MARKER.encode(), "audio/webm", 415),
    (b"RIFF1234NOTWAVE", "audio/wav", 415),
    (WAV + b"a" * speech.MAX_AUDIO_BYTES, "audio/wav", 413),
])
def test_reject_invalid_upload_before_provider(client, monkeypatch, audio, mime, status):
    call = AsyncMock()
    monkeypatch.setattr(interview, "transcribe_audio", call)
    response = client.post("/api/v1/interview/transcribe", content=audio, headers={"Content-Type": mime})
    assert response.status_code == status
    assert response.headers["cache-control"] == "no-store"
    assert MARKER not in response.text
    call.assert_not_called()


@pytest.mark.parametrize("audio,mime,extension", [
    (b"\x1aE\xdf\xa3test", "audio/webm;codecs=opus", "webm"),
    (b"OggStest", "audio/ogg", "ogg"),
    (b"\x00\x00\x00\x18ftypM4A ", "audio/mp4", "m4a"),
    (b"\x00\x00\x00\x18ftypM4A ", "audio/x-m4a", "m4a"),
    (WAV, "audio/wav", "wav"),
])
def test_browser_formats(audio, mime, extension):
    assert speech.validate_audio(audio, mime)[0] == extension


def test_large_audio_uses_audio_limit_only(client, monkeypatch):
    monkeypatch.setattr(interview, "transcribe_audio", AsyncMock(return_value="A synthetic answer."))
    response = client.post("/api/v1/interview/transcribe", content=WAV + b"a" * 200_001, headers={"Content-Type": "audio/wav"})
    assert response.status_code == 200
    assert response.json() == {"text": "A synthetic answer."}
    assert response.headers["cache-control"] == "no-store"
    response = client.post("/api/v1/interview/plan", content=b"a" * 200_001)
    assert response.status_code == 413


def test_transcription_not_configured(client, configured, monkeypatch):
    monkeypatch.setattr(speech.settings, "speech_api_key", "")
    response = client.post("/api/v1/interview/transcribe", content=WAV, headers={"Content-Type": "audio/wav"})
    assert response.status_code == 503
    assert "not configured" in response.json()["detail"]
    assert response.headers["cache-control"] == "no-store"


def test_provider_receives_multipart_audio_only(client, configured, monkeypatch):
    def respond(request):
        assert str(request.url) == "https://speech.example.test/v1/audio/transcriptions"
        assert request.headers["authorization"] == "Bearer synthetic-speech-key"
        assert request.headers["content-type"].startswith("multipart/form-data;")
        body = request.read()
        assert WAV in body and b'filename="answer.wav"' in body
        for expected in (b'name="model"', b"synthetic-model", b'name="language"', b"en", b'name="response_format"', b"json"):
            assert expected in body
        return httpx.Response(200, json={"text": "  I checked the totals.  "})
    provider(monkeypatch, respond)
    response = client.post("/api/v1/interview/transcribe", content=WAV, headers={"Content-Type": "audio/wav"})
    assert response.status_code == 200
    assert response.json() == {"text": "I checked the totals."}


@pytest.mark.parametrize("status,body,expected", [
    (302, MARKER, 503), (401, MARKER, 503), (429, MARKER, 503), (500, MARKER, 503),
    (200, MARKER, 503), (200, json.dumps({"text": 1}), 503),
    (200, json.dumps({"text": "a" * 4001}), 503),
    (200, json.dumps({"text": " "}), 422),
    (200, "a" * (speech.MAX_RESPONSE_BYTES + 1), 503),
])
def test_provider_failures_are_private(client, configured, monkeypatch, status, body, expected):
    provider(monkeypatch, lambda request: httpx.Response(status, content=body))
    response = client.post("/api/v1/interview/transcribe", content=WAV, headers={"Content-Type": "audio/wav"})
    assert response.status_code == expected
    assert MARKER not in response.text
    assert "synthetic-speech-key" not in response.text
    assert response.headers["cache-control"] == "no-store"


@pytest.mark.parametrize("error,status", [(httpx.ReadTimeout(MARKER), 504), (httpx.ConnectError(MARKER), 503)])
def test_provider_network_errors_are_private(client, configured, monkeypatch, error, status):
    def respond(request):
        raise error
    provider(monkeypatch, respond)
    response = client.post("/api/v1/interview/transcribe", content=WAV, headers={"Content-Type": "audio/wav"})
    assert response.status_code == status
    assert MARKER not in response.text
    assert response.headers["cache-control"] == "no-store"


def test_total_provider_deadline(client, configured, monkeypatch):
    async def stalled(request):
        await asyncio.Future()
    provider(monkeypatch, stalled)
    monkeypatch.setattr(speech, "TRANSCRIPTION_TIMEOUT", 0.01)
    response = client.post("/api/v1/interview/transcribe", content=WAV, headers={"Content-Type": "audio/wav"})
    assert response.status_code == 504
    assert response.headers["cache-control"] == "no-store"


def test_disconnect_cancels_provider_and_releases_account(monkeypatch):
    async def check():
        started, cancelled = asyncio.Event(), asyncio.Event()
        async def slow(*args):
            started.set()
            try:
                await asyncio.Future()
            finally:
                cancelled.set()
        async def receive():
            await started.wait()
            return {"type": "http.disconnect"}
        request = Request({"type": "http", "method": "POST", "path": "/interview/transcribe", "headers": [(b"content-type", b"audio/wav")]}, receive)
        request._body = WAV
        user = SimpleNamespace(id=uuid.uuid4())
        monkeypatch.setattr(interview, "transcribe_audio", slow)
        response = await interview.transcribe(request, user)
        assert response.status_code == 499
        assert cancelled.is_set()
        assert user.id not in interview._TRANSCRIBING
    asyncio.run(check())


def test_same_account_cannot_start_second_transcription(monkeypatch):
    async def check():
        started, finish = asyncio.Event(), asyncio.Event()
        async def slow(*args):
            started.set()
            await finish.wait()
            return "A synthetic answer."
        async def receive():
            await asyncio.Future()
        user = SimpleNamespace(id=uuid.uuid4())
        def request():
            value = Request({"type": "http", "method": "POST", "path": "/interview/transcribe", "headers": [(b"content-type", b"audio/wav")]}, receive)
            value._body = WAV
            return value
        monkeypatch.setattr(interview, "transcribe_audio", slow)
        first = asyncio.create_task(interview.transcribe(request(), user))
        await started.wait()
        with pytest.raises(HTTPException) as error:
            await interview.transcribe(request(), user)
        assert error.value.status_code == 429
        finish.set()
        assert (await first).status_code == 200
        assert user.id not in interview._TRANSCRIBING
    asyncio.run(check())
