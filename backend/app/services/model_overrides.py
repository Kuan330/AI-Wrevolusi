"""Request-scoped browser model overrides; never change environment or user records."""
from contextvars import ContextVar
from collections import deque
import json
import re
import threading
import time
from typing import Any
from pydantic import BaseModel, RootModel
from starlette.concurrency import run_in_threadpool

_models: ContextVar[tuple[str, ...]] = ContextVar("aiw_models", default=())
_rate_lock = threading.Lock()
_rate_times: deque[float] = deque()
MODEL_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,159}\Z")

class ModelOverrideError(RuntimeError):
    def __init__(self, code="ai_models_unavailable"):
        self.code = code
        super().__init__("The selected AI models could not complete this request. Check the developer settings or restore defaults.")

def current_models():
    return _models.get()

def parse_models(value):
    if value is None: return ()
    try:
        if len(value) > 1100: raise ValueError()
        values = json.loads(value)
        if not isinstance(values, list) or not 1 <= len(values) <= 5: raise ValueError()
        if not all(isinstance(v, str) and MODEL_ID.fullmatch(v) for v in values): raise ValueError()
        if len(set(values)) != len(values): raise ValueError()
        return tuple(values)
    except (ValueError, TypeError):
        raise ModelOverrideError("ai_models_invalid") from None

class ModelOverrideMiddleware:
    def __init__(self, app): self.app = app
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http": return await self.app(scope, receive, send)
        from starlette.responses import JSONResponse
        values = [v for k, v in scope.get("headers", []) if k.lower() == b"x-aiw-models"]
        try:
            if len(values) > 1: raise ModelOverrideError("ai_models_invalid")
            models = parse_models(values[0].decode("ascii") if values else None)
        except (ModelOverrideError, UnicodeError):
            return await JSONResponse({"detail": "Invalid model priority list.", "code": "ai_models_invalid", "fields": []}, status_code=422, headers={"Cache-Control": "no-store"})(scope, receive, send)
        token = _models.set(models)
        try: await self.app(scope, receive, send)
        finally: _models.reset(token)

def model_provider(model, timeout_s, max_tokens):
    from app.core.config import settings
    from app.services.ai_gateway import OpenAICompatibleProvider
    try: headers = json.loads(settings.ai_extra_headers or "{}")
    except (ValueError, TypeError): raise ModelOverrideError("ai_configuration_invalid") from None
    if not isinstance(headers, dict) or not all(isinstance(k, str) and isinstance(v, str) for k, v in headers.items()):
        raise ModelOverrideError("ai_configuration_invalid")
    provider = OpenAICompatibleProvider(api_key=settings.ai_api_key, model=model,
        base_url=settings.ai_base_url, api_mode=settings.ai_api_mode, keyless=False,
        extra_headers=headers, timeout_s=timeout_s, max_retries=0, cache_size=0,
        rpm_limit=settings.ai_rpm_limit, max_tokens=max_tokens)
    # All override requests share a budget, independent of browser/model lists.
    provider._lock = _rate_lock
    provider._request_times = _rate_times
    return provider

class PriorityProvider:
    name = "configured-priority"
    strict_override = True
    def __init__(self, models, timeout_s, max_tokens=None):
        from app.core.config import settings
        if not (settings.ai_api_key or "").strip(): raise ModelOverrideError("ai_not_configured")
        self.models, self.timeout_s, self.max_tokens = models, timeout_s, max_tokens
        self.selected_model = None
        self.locked = False
        self.deadline = None
    def lock_model(self): self.locked = True
    async def complete_json_async(self, **kwargs):
        # Async resume flows use the first model only, including assistant repair.
        # The caller owns the total deadline; never rotate models or re-cap it.
        timeout_s = float(kwargs.get("request_timeout_s") or self.timeout_s)
        provider = model_provider(self.models[0], timeout_s, self.max_tokens)
        try:
            return await provider.complete_json_async(**{**kwargs, "request_timeout_s": timeout_s})
        finally:
            provider.close()

    def complete_json(self, **kwargs):
        from app.services.ai_gateway import AIProviderError
        if self.deadline is None: self.deadline = time.monotonic() + self.timeout_s
        deadline = min(self.deadline, time.monotonic() + float(kwargs.get("request_timeout_s") or self.timeout_s))
        models = (self.selected_model,) if self.locked and self.selected_model else self.models
        for model in models:
            remaining = deadline - time.monotonic()
            if remaining < 0.1: raise ModelOverrideError("ai_budget_exhausted")
            provider = model_provider(model, remaining, self.max_tokens)
            try:
                result = provider.complete_json(**{**kwargs, "request_timeout_s": remaining, "request_max_retries": 0, "request_cache_enabled": False})
                if time.monotonic() >= deadline: raise ModelOverrideError("ai_budget_exhausted")
                self.selected_model = model
                return result
            except AIProviderError as error:
                status = error.status_code
                retryable = error.kind in {"transport", "model_unavailable"} or error.kind == "http" and (status in {404, 408, 409, 425, 429} or status is not None and status >= 500)
                if not retryable:
                    code = "ai_credentials_invalid" if status in {401, 403} else "ai_request_rejected" if error.kind == "http" else "ai_rate_limited" if error.kind == "local_limit" else "ai_output_invalid"
                    raise ModelOverrideError(code) from None
            finally: provider.close()
        raise ModelOverrideError()

def priority_provider(timeout_s=None, max_tokens=None):
    from app.core.config import settings
    return PriorityProvider(current_models(), float(timeout_s or settings.ai_timeout_seconds), max_tokens)

class JsonObject(RootModel[dict[str, Any]]): pass

async def skill_override(instructions, payload, timeout_s, response_model=JsonObject):
    provider = priority_provider(timeout_s, max_tokens=6500)
    return await run_in_threadpool(provider.complete_json, operation="learning.override.v1", payload=payload,
        response_model=response_model, system_prompt=instructions,
        request_timeout_s=timeout_s, request_max_retries=0, request_cache_enabled=False)
