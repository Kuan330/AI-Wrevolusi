"""No real providers: verify request isolation, explicit priorities and deadlines."""
import asyncio
import json
from types import SimpleNamespace
import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.core.config import settings
from app.services import model_overrides as overrides
from app.services.ai_gateway import AIGateway, AIProviderError, OpenAICompatibleProvider, default_ai_gateway
from app.schemas.resume import GenerateRequest, GenerateResponse
from app.services.resume import generate_resume, resume_provider

@pytest.fixture(autouse=True)
def configured(monkeypatch):
    monkeypatch.setattr(settings, "ai_api_key", "synthetic-test-key")

@pytest.mark.parametrize("models", ['[]', '"model"', '[" "]', '["x","x"]', '["x\\n"]', '["<script>"]', '["x"]' + ' ' * 1100, json.dumps(["x"] * 6), json.dumps(["x" * 161])])
def test_invalid_lists(models):
    with pytest.raises(overrides.ModelOverrideError): overrides.parse_models(models)

@pytest.mark.parametrize("models", [["deepseek-v4.1-flash"], ["openai/gpt-5-mini", "vendor:model@latest+fast"]])
def test_valid_lists(models): assert overrides.parse_models(json.dumps(models)) == tuple(models)

class FakeProvider:
    def __init__(self, result, calls, model): self.result, self.calls, self.model, self.closed = result, calls, model, False
    def complete_json(self, **kwargs):
        self.calls.append((self.model, kwargs))
        if isinstance(self.result, Exception): raise self.result
        return self.result
    def close(self): self.closed = True

@pytest.mark.parametrize("failure", [AIProviderError("safe", status_code=404, kind="http"), AIProviderError("safe", status_code=429, kind="http"), AIProviderError("safe", status_code=503, kind="http"), AIProviderError("safe", kind="transport"), AIProviderError("safe", kind="model_unavailable")])
def test_priority_on_transport_only(monkeypatch, failure):
    calls, providers = [], []
    def factory(model, timeout, tokens):
        provider = FakeProvider(failure if model == "first" else {"sections": []}, calls, model); providers.append(provider); return provider
    monkeypatch.setattr(overrides, "model_provider", factory)
    provider = overrides.PriorityProvider(("first", "second", "third"), 45)
    assert provider.complete_json(response_model=GenerateResponse) == {"sections": []}
    assert [m for m, _ in calls] == ["first", "second"]
    assert all(p.closed for p in providers)
    assert all(k["request_max_retries"] == 0 and not k["request_cache_enabled"] for _, k in calls)

@pytest.mark.parametrize("failure", [AIProviderError("no body", status_code=401, kind="http"), AIProviderError("no body", status_code=403, kind="http"), AIProviderError("no body", status_code=400, kind="http"), AIProviderError("no body", kind="output"), AIProviderError("safe", kind="local_limit")])
def test_no_failover_for_credentials_request_schema_or_local_budget(monkeypatch, failure):
    calls = []
    monkeypatch.setattr(overrides, "model_provider", lambda m, t, n: FakeProvider(failure, calls, m))
    with pytest.raises(overrides.ModelOverrideError): overrides.PriorityProvider(("a", "b"), 45).complete_json()
    assert [m for m, _ in calls] == ["a"]

def test_expired_budget_stops_before_next_model(monkeypatch):
    calls, clock = [], [0]
    class Slow(FakeProvider):
        def complete_json(self, **kwargs): clock[0] = 46; return super().complete_json(**kwargs)
    monkeypatch.setattr(overrides.time, "monotonic", lambda: clock[0])
    monkeypatch.setattr(overrides, "model_provider", lambda m, t, n: Slow(AIProviderError("safe", kind="transport"), calls, m))
    with pytest.raises(overrides.ModelOverrideError) as caught: overrides.PriorityProvider(("a", "b"), 45).complete_json()
    assert caught.value.code == "ai_budget_exhausted" and len(calls) == 1

def test_repair_is_pinned_to_successful_model(monkeypatch):
    calls, count = [], [0]
    good = {"sections": [{"title": "Skills", "entries": [{"text": "SQL", "skill_ids": ["sql"]}]}]}
    class Result(FakeProvider):
        def complete_json(self, **kwargs):
            self.calls.append((self.model, kwargs)); count[0] += 1
            if self.model == "a": raise AIProviderError("safe", kind="transport")
            return {"sections": [{"title": "Skills", "entries": [{"text": "Expert SQL", "skill_ids": ["sql"]}]}]} if count[0] == 2 else good
    monkeypatch.setattr(overrides, "model_provider", lambda m,t,n: Result(None, calls, m))
    provider = overrides.PriorityProvider(("a", "b", "c"), 45)
    result = generate_resume(GenerateRequest(job_requirements="SQL", skills=[{"id":"sql","name":"SQL"}]), provider)
    assert result.sections[0].entries[0].text == "SQL"
    assert [m for m, _ in calls] == ["a", "b", "b"]
    assert "Expert SQL" not in json.dumps(calls[-1][1]["payload"])

def test_context_is_reset_and_isolated_between_requests():
    app = FastAPI(); app.add_middleware(overrides.ModelOverrideMiddleware)
    @app.get("/scope")
    async def scope(): return {"models": overrides.current_models()}
    with TestClient(app) as client:
        assert client.get("/scope", headers={"X-AIW-Models": '["first"]'}).json() == {"models": ["first"]}
        assert client.get("/scope").json() == {"models": []}
        invalid = client.get("/scope", headers={"X-AIW-Models": '["private@example.test", "private@example.test"]'})
        assert invalid.status_code == 422 and "private@example.test" not in invalid.text
    assert not overrides.current_models()

def test_gateway_does_not_return_deterministic_success(monkeypatch):
    calls = []; provider = overrides.PriorityProvider(("a",), 20)
    monkeypatch.setattr(overrides, "model_provider", lambda m,t,n: FakeProvider(AIProviderError("safe",kind="transport"), calls,m))
    with pytest.raises(overrides.ModelOverrideError):
        AIGateway(provider=provider).run_structured(operation="test",payload={},response_model=GenerateResponse,local=lambda: {"sections": []},fallback=lambda: {"sections": []})

def test_no_key_never_uses_anonymous_fallback(monkeypatch):
    monkeypatch.setattr(settings, "ai_api_key", "")
    with pytest.raises(overrides.ModelOverrideError): overrides.PriorityProvider(("a",), 20)

@pytest.mark.parametrize("code,status,expected", [("model_not_found",400,"model_unavailable"),("invalid_request",400,"http"),("model_not_supported",422,"model_unavailable")])
def test_provider_classifies_fixed_codes_without_echoing_values(code,status,expected):
    client = httpx.Client(transport=httpx.MockTransport(lambda _: httpx.Response(status,json={"error":{"code":code,"message":"DO-NOT-ECHO"}})))
    provider = OpenAICompatibleProvider(api_key="synthetic-key",model="a",client=client,max_retries=0)
    with pytest.raises(AIProviderError) as caught: provider.complete_json(operation="test",payload={},response_model=GenerateResponse)
    assert caught.value.kind == expected and "DO-NOT-ECHO" not in str(caught.value)
    client.close()

def test_async_skill_services_use_main_override(monkeypatch):
    async def scenario():
        from app.services.learning_goal import suggest_learning_goal, LearningGoalRequest
        from app.services.guided_learning import model_json
        import app.services.learning_goal as goals
        import app.services.guided_learning as guided
        calls = []
        async def fake(instructions,payload,timeout,response_model=None): calls.append(payload); return {"goal": "Practice SQL with synthetic data"}
        monkeypatch.setattr(goals,"skill_override",fake);monkeypatch.setattr(guided,"skill_override",fake)
        token=overrides._models.set(("a",))
        try:
            assert (await suggest_learning_goal(LearningGoalRequest(skill="SQL",level="starting"))).goal
            assert await model_json("Instructions",{"data":"synthetic"})
            assert len(calls)==2
            assert default_ai_gateway().provider.models == ("a",)
            assert resume_provider().models == ("a",)
        finally: overrides._models.reset(token)
    asyncio.run(scenario())


def test_optional_search_and_judge_do_not_hide_override_failure():
    from app.services.ai_task_judge import LLMTaskMatchJudge
    from app.services.occupation_search import normalise_search_query
    class Failing:
        strict_override=True
        def complete_json(self,**kwargs):raise overrides.ModelOverrideError()
    gateway=AIGateway(provider=Failing())
    with pytest.raises(overrides.ModelOverrideError):normalise_search_query("synthetic",gateway)
    with pytest.raises(overrides.ModelOverrideError):LLMTaskMatchJudge(gateway).match_task("a","synthetic",[])

def test_rate_state_is_shared_across_override_model_choices(monkeypatch):
    providers=[overrides.model_provider("a",20,None),overrides.model_provider("b",20,None)]
    try:
        assert providers[0]._request_times is providers[1]._request_times
        assert providers[0]._lock is providers[1]._lock
        assert providers[0].max_retries==0
    finally:
        for provider in providers:provider.close()

def test_cors_accepts_header_and_safe_invalid_header_error():
    from app.main import create_app
    app=create_app()
    with TestClient(app) as client:
        origin=settings.cors_origins[0]
        response=client.options("/api/v1/resume/assist",headers={"Origin":origin,"Access-Control-Request-Method":"POST","Access-Control-Request-Headers":"X-AIW-Models,Content-Type"})
        assert response.status_code==200 and "x-aiw-models" in response.headers["access-control-allow-headers"].lower()
        invalid=client.post("/api/v1/resume/assist",headers={"Origin":origin,"X-AIW-Models":"[]"})
        assert invalid.status_code==422 and invalid.headers["access-control-allow-origin"]==origin


def test_course_override_failure_is_explicit_and_default_failure_stays_optional(monkeypatch):
    from app.routers import resume as routes
    from app.schemas.resume import RecommendRequest
    class Rows:
        def mappings(self): return self
        def all(self): return []
    class Database:
        async def execute(self, query): return Rows()
    payload = RecommendRequest(gaps=[{"id": "gap-1", "label": "SQL"}])
    def fail_override(): raise overrides.ModelOverrideError("ai_not_configured")
    monkeypatch.setattr(routes, "resume_provider", fail_override)
    with pytest.raises(overrides.ModelOverrideError):
        asyncio.run(routes.recommendations(payload, Database()))
    def fail_default(): raise RuntimeError("Synthetic default failure")
    monkeypatch.setattr(routes, "resume_provider", fail_default)
    assert asyncio.run(routes.recommendations(payload, Database())).courses == []


def test_override_gateway_never_reads_or_writes_content_cache():
    class Provider:
        strict_override = True
        calls = 0
        def complete_json(self, **kwargs):
            self.calls += 1
            assert kwargs["request_cache_enabled"] is False
            return {"sections": []}
    provider = Provider()
    cached = {"same": {"sections": [{"title": "Skills", "entries": []}]}}
    gateway = AIGateway(provider=provider, cache=cached)
    for _ in range(2):
        result = gateway.run_structured(operation="test", payload={}, response_model=GenerateResponse,
            local=lambda: {}, fallback=lambda: {}, cache_key="same")
        assert result.value.sections == [] and result.metadata.cached is False
    assert provider.calls == 2 and cached["same"]["sections"][0]["title"] == "Skills"
