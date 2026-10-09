"""Offline v2: exact source structure, one cancellable call and honest fallback."""
import asyncio
import copy
from types import SimpleNamespace
import pytest
from pydantic import ValidationError
from app.schemas.resume import GenerateRequest
from app.schemas.resume_sources import section_heading
from app.services import resume_generation as service
from app.services.ai_gateway import AIProviderError, OpenAICompatibleProvider
from app.services.resume_errors import GenerationFailure, GenerationRejected


def payload():
    lines = ['Core Skills', 'SQL, Excel', 'Professional Experience', 'ABC Insurance Berhad, Kuala Lumpur',
             '• Managed 250+ clients, achieving a 92% renewal rate.', 'Education', 'University of Malaya',
             'Projects', 'Retail Sales Analysis | Apr 2026', '• Cleaned 2,400 records.', '• Removed 36 duplicates.',
             'Student Survey Review | Nov 2025', '• Reviewed 180 responses.', 'Licenses & Certifications', 'Original source qualification']
    evidence = [{'id':f'f-{i}', 'text':text} for i,text in enumerate(lines)]
    sections, active = [], None
    for fact in evidence:
        title = section_heading(fact['text'])
        if title:
            active={'title':title,'heading_fact_id':fact['id'],'fact_ids':[],'polishable_fact_ids':[]};sections.append(active)
        else:
            active['fact_ids'].append(fact['id'])
            if active['title']=='Experience' and fact['text'].startswith('•'):active['polishable_fact_ids'].append(fact['id'])
    return {'job_requirements':'Management and Organization Analysts\n- Analytical thinking\n- SQL','skills':[{'id':'sql','name':'SQL'},{'id':'excel','name':'Excel'},{'id':'learning','name':'Creative thinking'}],
            'evidence':evidence,'evidence_reviewed':True,'source_sections':sections,
            'source_projects':[{'id':'p1','mode':'structured','name':'Retail Sales Analysis','date':'Apr 2026','fact_ids':['f-8','f-9','f-10'],'highlight_fact_ids':['f-9','f-10']},
                               {'id':'p2','mode':'structured','name':'Student Survey Review','date':'Nov 2025','fact_ids':['f-11','f-12'],'highlight_fact_ids':['f-12']}]}


class Provider:
    def __init__(self, output=None, error=None):self.calls=[];self.output=output;self.error=error
    async def complete_json_async(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:raise self.error
        return self.output if self.output is not None else {'patches':[{'fact_id':f['id'],'text':f['text'].lstrip('• ')} for f in kwargs['payload']['facts']], 'gaps':[]}


def run(provider, data=None):return asyncio.run(service.generate_reviewed_resume(GenerateRequest.model_validate(data or payload()), provider))


def test_single_compact_call_preserves_all_skills_and_source_structure():
    provider=Provider();original=payload();before=copy.deepcopy(original);result=run(provider,original)
    assert len(provider.calls)==1
    sent=provider.calls[0]['payload']
    assert set(sent)=={'job_requirements','skill_names','facts'}
    assert 'source_projects' not in sent and 'Retail Sales Analysis' not in str(sent['facts'])
    assert provider.calls[0]['request_timeout_s']==60
    assert provider.calls[0]['request_max_tokens']<6500
    assert result.outcome=='tailored'
    assert {e.text for e in result.sections[0].entries} == {s['name'] for s in original['skills']}
    assert all(len(e.skill_ids) == 1 for e in result.sections[0].entries)
    projects=next(s for s in result.sections if s.title=='Projects').entries
    assert [(p.project.name,p.project.date) for p in projects]==[('Retail Sales Analysis','Apr 2026'),('Student Survey Review','Nov 2025')]
    assert projects[0].project.highlights==['Cleaned 2,400 records.','Removed 36 duplicates.']
    assert next(s for s in result.sections if s.title=='Licenses & Certifications').entries[0].text=='Original source qualification'
    assert all(e.verbatim for s in result.sections if s.title in {'Experience','Education','Licenses & Certifications'} for e in s.entries)
    assert original==before


@pytest.mark.parametrize('patch',[
    {'fact_id':'f-9','text':'Cleaned 9,000 records.'},
    {'fact_id':'f-9','text':'Cleaned 2,400 records and increased revenue.'},
    {'fact_id':'f-9','text':'Reviewed 180 responses.'},
    {'fact_id':'f-9','text':'Certified expert cleaned 2,400 records.'},
    {'fact_id':'invented-project','text':'A new project.'},
])
def test_bad_patch_is_replaced_with_original_without_retry(patch):
    provider=Provider(output={'patches':[patch],'gaps':[]});result=run(provider)
    assert len(provider.calls)==1 and result.outcome=='source_preserved'
    assert 'unsupported_polish' in result.notices
    assert next(s for s in result.sections if s.title=='Projects').entries[0].project.highlights==['Cleaned 2,400 records.','Removed 36 duplicates.']
    assert not result.gaps


def test_valid_patch_survives_another_bad_patch():
    provider=Provider(output={'patches':[{'fact_id':'f-9','text':'Cleaned 2,400 records.'},{'fact_id':'f-10','text':'Removed 99 duplicates.'}],'gaps':[]})
    result=run(provider);assert result.outcome=='source_preserved'
    assert next(s for s in result.sections if s.title=='Projects').entries[0].project.highlights==['Cleaned 2,400 records.','Removed 36 duplicates.']


@pytest.mark.parametrize('error,notice',[(AIProviderError('PRIVATE',kind='transport'),'ai_unavailable'),(AIProviderError('PRIVATE',status_code=503,kind='http'),'ai_unavailable'),(AIProviderError('PRIVATE',kind='timeout'),'ai_timeout'),(AIProviderError('PRIVATE',kind='output'),'ai_output_invalid')])
def test_upstream_failures_return_honest_source_preservation(error,notice,caplog):
    provider=Provider(error=error);result=run(provider)
    assert result.outcome=='source_preserved' and result.notices==[notice] and len(provider.calls)==1
    assert next(s for s in result.sections if s.title=='Experience').entries[1].text==payload()['evidence'][4]['text']
    assert not result.gaps and 'PRIVATE' not in caplog.text


@pytest.mark.parametrize('output',[{}, {'patches':[{'new_project':'PRIVATE'}]}, {'patches':'PRIVATE'}])
def test_invalid_model_schema_falls_back_without_retry(output):
    provider=Provider(output=output);result=run(provider)
    assert result.outcome=='source_preserved' and len(provider.calls)==1


@pytest.mark.parametrize('status',[400,401,403,404,422])
def test_auth_or_configuration_errors_are_not_masked(status):
    with pytest.raises(GenerationFailure):run(Provider(error=AIProviderError('PRIVATE',status_code=status,kind='http')))


def test_internal_errors_are_not_masked():
    with pytest.raises(RuntimeError):run(Provider(error=RuntimeError('PRIVATE')))


def test_total_deadline_cancels_upstream_coroutine(monkeypatch):
    class Slow(Provider):
        cancelled=False
        async def complete_json_async(self,**kwargs):
            self.calls.append(kwargs)
            try:await asyncio.sleep(10)
            finally:self.cancelled=True
    monkeypatch.setattr(service,'GENERATION_BUDGET_SECONDS',0.02)
    provider=Slow();result=run(provider)
    assert provider.cancelled and len(provider.calls)==1 and result.notices==['ai_timeout']


def test_user_cancel_propagates_not_fallback():
    async def scenario():
        started=asyncio.Event();stopped=asyncio.Event()
        class Slow:
            async def complete_json_async(self,**kwargs):
                started.set()
                try:await asyncio.sleep(10)
                finally:stopped.set()
        task=asyncio.create_task(service.generate_reviewed_resume(GenerateRequest.model_validate(payload()),Slow()))
        await started.wait();task.cancel()
        with pytest.raises(asyncio.CancelledError):await task
        assert stopped.is_set()
    asyncio.run(scenario())


def test_request_disconnect_cancels_real_generation_task():
    from app.routers.resume import generate
    async def scenario():
        started=asyncio.Event();stopped=asyncio.Event()
        class Slow:
            async def complete_json_async(self,**kwargs):
                started.set()
                try:await asyncio.sleep(10)
                finally:stopped.set()
        async def receive():
            await started.wait()
            return {"type":"http.disconnect"}
        response=await generate(GenerateRequest.model_validate(payload()),SimpleNamespace(receive=receive),Slow())
        assert response.status_code==499 and stopped.is_set()
    asyncio.run(scenario())


def test_async_http_transport_is_actually_cancelled(monkeypatch):
    import httpx
    from app.services import ai_gateway
    real=httpx.AsyncClient;stopped=[]
    async def handler(request):
        try:await asyncio.sleep(10)
        finally:stopped.append(True)
    monkeypatch.setattr(ai_gateway.httpx,'AsyncClient',lambda **kw:real(transport=httpx.MockTransport(handler),**kw))
    provider=OpenAICompatibleProvider(api_key='synthetic',model='synthetic',cache_size=0)
    try:
        monkeypatch.setattr(service,'GENERATION_BUDGET_SECONDS',0.02)
        result=run(provider)
        assert result.notices==['ai_timeout'] and stopped
    finally:provider.close()


def test_skills_only_never_calls_ai():
    data={'job_requirements':'Target','skills':[{'id':'sql','name':'SQL'}],'source_sections':[],'source_projects':[]}
    provider=Provider();result=run(provider,data)
    assert not provider.calls and result.sections[0].entries[0].text=='SQL'
    assert result.notices==['no_polishable_evidence']


@pytest.mark.parametrize('change',[
    lambda p:p['source_sections'][0].update(title='Experience'),
    lambda p:p['source_sections'][1]['fact_ids'].append('f-9'),
    lambda p:p['source_sections'][1]['polishable_fact_ids'].append('f-3'),
    lambda p:p['source_projects'].pop(),
])
def test_tampered_section_or_project_ownership_fails_before_ai(change):
    data=payload();change(data)
    with pytest.raises(ValidationError):GenerateRequest.model_validate(data)


def test_shared_assistant_validator_does_not_allow_arbitrary_sections():
    from app.schemas.resume import GenerateResponse
    from app.services.resume import validate_generation
    with pytest.raises(GenerationRejected):validate_generation(GenerateResponse(sections=[{'title':'Invented section','entries':[]}]),GenerateRequest.model_validate(payload()))


def test_real_asgi_route_returns_without_hanging_in_disconnect_cleanup():
    import httpx
    from fastapi import FastAPI
    from app.routers.resume import router, get_resume_provider
    from app.services.auth import get_current_user
    async def scenario():
        app=FastAPI();app.include_router(router,prefix='/api/v1')
        app.dependency_overrides[get_current_user]=lambda:SimpleNamespace(id='synthetic')
        app.dependency_overrides[get_resume_provider]=lambda:Provider()
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://synthetic') as client:
            async with asyncio.timeout(2):
                response=await client.post('/api/v1/resume/generate',json=payload())
        assert response.status_code==200 and response.json()['outcome']=='tailored'
    asyncio.run(scenario())


def test_regional_spelling_polish_does_not_invent_an_action():
    from app.schemas.resume import Evidence
    request=GenerateRequest.model_validate(payload())
    fact=Evidence(id='extra',text='• Analysed 180 responses.')
    request.evidence.append(fact)
    service.validate_polish('Analyzed 180 responses.',fact,request)


def test_model_override_uses_one_priority_and_closes_its_provider(monkeypatch):
    from app.services import model_overrides as overrides
    from app.core.config import settings
    monkeypatch.setattr(settings,'ai_api_key','synthetic')
    created=[];closed=[]
    class Dummy:
        async def complete_json_async(self,**kwargs):
            raise AIProviderError('Synthetic transport',kind='transport')
        def close(self):closed.append(True)
    def create(model,timeout_s,max_tokens):created.append(model);return Dummy()
    monkeypatch.setattr(overrides,'model_provider',create)
    priority=overrides.PriorityProvider(('first','second'),30,1000)
    with pytest.raises(AIProviderError):asyncio.run(priority.complete_json_async(operation='synthetic'))
    assert created==['first'] and closed==[True]


@pytest.mark.parametrize('mode',['chat_completions','responses'])
def test_async_gateway_reuses_wire_protocol_and_caps_output_without_retry(monkeypatch,mode):
    import httpx
    from app.services import ai_gateway
    real=httpx.AsyncClient;requests=[]
    async def handler(request):
        import json
        requests.append(json.loads(request.content))
        if mode=='responses':return httpx.Response(200,json={'output_text':'{"patches":[],"gaps":[]}'})
        return httpx.Response(200,json={'choices':[{'message':{'content':'{"patches":[],"gaps":[]}'}}]})
    monkeypatch.setattr(ai_gateway.httpx,'AsyncClient',lambda **kw:real(transport=httpx.MockTransport(handler),**kw))
    provider=OpenAICompatibleProvider(api_key='synthetic',model='synthetic',api_mode=mode,cache_size=0)
    from app.schemas.resume import ResumePolishResponse
    try:
        result=asyncio.run(provider.complete_json_async(operation='synthetic',payload={},response_model=ResumePolishResponse,request_max_tokens=800))
        assert result['patches']==[] and len(requests)==1
        assert requests[0]['max_output_tokens' if mode=='responses' else 'max_tokens']==800
    finally:provider.close()


@pytest.mark.parametrize("elapsed,outcome", [(31, "tailored"), (61, "source_preserved")])
def test_sixty_second_deadline_accepts_slow_response_then_cancels(monkeypatch, elapsed, outcome):
    # Scale one virtual second to ten milliseconds; do not wait a minute or call live AI.
    real_timeout = asyncio.timeout
    deadlines = []
    def scaled_timeout(seconds):
        deadlines.append(seconds)
        return real_timeout(seconds / 100)
    monkeypatch.setattr(service.asyncio, "timeout", scaled_timeout)
    class Slow(Provider):
        cancelled = False
        async def complete_json_async(self, **kwargs):
            try:
                await asyncio.sleep(elapsed / 100)
                return await super().complete_json_async(**kwargs)
            except asyncio.CancelledError:
                self.cancelled = True
                self.calls.append(kwargs)
                raise
    provider = Slow()
    result = run(provider)
    assert deadlines == [60] and len(provider.calls) == 1
    assert provider.calls[0]["request_timeout_s"] == 60
    assert result.outcome == outcome
    assert provider.cancelled == (outcome == "source_preserved")
    assert len(result.sections[0].entries) == len(payload()["skills"])
    assert all(len(entry.skill_ids) == 1 for entry in result.sections[0].entries)
    if provider.cancelled: assert result.notices == ["ai_timeout"]


def test_model_override_forwards_requested_budget_not_hardcoded_thirty(monkeypatch):
    from app.services import model_overrides as overrides
    from app.core.config import settings
    monkeypatch.setattr(settings, "ai_api_key", "synthetic")
    created, sent, closed = [], [], []
    class Dummy:
        async def complete_json_async(self, **kwargs):
            sent.append(kwargs)
            return {"patches": [], "gaps": []}
        def close(self): closed.append(True)
    def create(model, timeout_s, max_tokens):
        created.append((model, timeout_s))
        return Dummy()
    monkeypatch.setattr(overrides, "model_provider", create)
    priority = overrides.PriorityProvider(("first", "second"), 20, 1000)
    asyncio.run(priority.complete_json_async(operation="synthetic", request_timeout_s=60))
    assert created == [("first", 60)] and sent[0]["request_timeout_s"] == 60
    assert closed == [True]


@pytest.mark.parametrize("count", [81, 250])
def test_real_generation_route_serializes_all_individual_skill_entries(count):
    import httpx
    from fastapi import FastAPI
    from app.routers.resume import router, get_resume_provider
    from app.services.auth import get_current_user
    async def scenario():
        app = FastAPI()
        app.include_router(router, prefix="/api/v1")
        provider = Provider()
        app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id="synthetic")
        app.dependency_overrides[get_resume_provider] = lambda: provider
        data = {"job_requirements": "Synthetic role", "skills": [
            {"id": str(i), "name": f"Skill {i:03}"} for i in range(count)],
            "source_sections": [], "source_projects": []}
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://synthetic") as client:
            response = await client.post("/api/v1/resume/generate", json=data)
        assert response.status_code == 200
        entries = response.json()["sections"][0]["entries"]
        assert len(entries) == count and len(provider.calls) == 0
        assert [e["text"] for e in entries] == [s["name"] for s in data["skills"]]
        assert all(len(e["skill_ids"]) == 1 for e in entries)
    asyncio.run(scenario())
