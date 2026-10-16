"""Synthetic contract tests; no claims about live-model semantic accuracy."""
import asyncio
import copy
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from types import SimpleNamespace
from app.schemas.possibilities import OccupationRequirements
from app.schemas.resume import GenerateRequest, AssistRequest
from app.services.resume_generation import generate_reviewed_resume
from app.services.resume_learning import identify_learning_skills, validate_course_skill_sources
from app.services.catalogue import curriculum_fingerprint
from app.services.resume_errors import GenerationFailure, GenerationRejected
from app.services.ai_gateway import AIProviderError
from app.services.resume_assistant_patches import compact_context, assemble_assistance, CompactAssistResponse
from tests.test_resume_relevance import data, skill_names

INSURANCE = ['Needs analysis','cross-selling','policy renewals','lead generation','Life, medical, motor, property, and travel insurance','Underwriting guidelines','KYC/AML','claims documentation','Negotiation','active listening','client retention','objection handling','Salesforce','Microsoft Office','CRM system']

def event_role():
    return OccupationRequirements(occupation_code='3332',title='Conference and Event Planners',skills=[{'skill_id':10,'skill_slug':'service-orientation-and-customer-service','name':'Service orientation and customer service'},{'skill_id':21,'skill_slug':'reading-writing-and-mathematics','name':'Reading, writing and mathematics'}],tasks=['Meeting with clients to discuss their needs and outlining package options to meet these needs;','Negotiating the type and costs of services to be provided within budget;','Promoting conferences, conventions and trade shows to potential customers;'])

def source():
    original=data()
    role=event_role()
    names=[*INSURANCE,*[s.name for s in role.skills],'Strategic marketing communications']
    original.update(occupation_code=role.occupation_code,job_requirements='\n'.join([role.title,'Required skills:',*[f'- {s.name}' for s in role.skills]]),role_reference_fingerprint=role.reference_fingerprint,skills=[{'id':f'user-{i}','name':name} for i,name in enumerate(names)])
    original['source_metadata']={'version':'career_evidence_v2','skill_sources':[{'skill_id':f'user-{i}','origins':[{'kind':'learning_intention' if i==17 else 'platform_confirmed','label':'Reviewed learning choice' if i==17 else 'Confirmed source skill','fact_ids':[]}]} for i in range(len(names))],'learning_facts':[]}
    return original

class EventProvider:
    def __init__(self,transform=None,error=None): self.calls=[]; self.transform=transform; self.error=error
    async def complete_json_async(self,**kwargs):
        self.calls.append(kwargs)
        if self.error: raise self.error
        payload=kwargs['payload']; tasks=payload['target_role']['task_references']
        related={'Needs analysis':0,'active listening':0,'Negotiation':1,'Strategic marketing communications':2}
        output={'patches':[],'gaps':[],'skill_decisions':[{'candidate_id':c['candidate_id'],'requirement_skill_id':None,'task_id':tasks[related[c['name']]]['id'] if c['name'] in related else None} for c in payload['skill_candidates']],'summary':[],'project_order':[p['id'] for p in payload['source_projects']],'evidence_links':[]}
        if self.transform: self.transform(output)
        return output

def generate(provider=None,original=None):
    return asyncio.run(generate_reviewed_resume(GenerateRequest.model_validate(original or source()),provider or EventProvider(),event_role()))

def test_event_tasks_keep_existing_and_new_candidates_once_with_original_names():
    original=source(); before=copy.deepcopy(original); provider=EventProvider(); result=generate(provider,original)
    assert set(skill_names(result))=={'Needs analysis','active listening','Negotiation','Strategic marketing communications','Reading, writing and mathematics','Service orientation and customer service'}
    assert len(provider.calls)==1 and 59 < provider.calls[0]['request_timeout_s'] <= 60
    assert result.skill_filter_version=='role_relevance_v2' and result.tailoring_version=='career_evidence_v2'
    tasks={t['id'] for t in result.role_alignment.task_references}
    assert all(link.task_id in tasks for link in result.role_alignment.links if link.method=='ai_semantic')
    assert original==before

def test_invalid_polish_does_not_discard_task_decisions():
    result=generate(EventProvider(lambda out:out.update(patches=[{'fact_id':'f-4','text':5}])))
    assert 'Negotiation' in skill_names(result) and 'Strategic marketing communications' in skill_names(result)
    assert 'unsupported_polish' in result.notices

@pytest.mark.parametrize('variant',['unknown','cross-role','both','duplicate','missing'])
def test_invalid_task_decisions_fail_closed_without_losing_standard_matches(variant):
    def change(out):
        row=out['skill_decisions'][0]
        if variant=='unknown':row['candidate_id']='unknown'
        elif variant=='cross-role':row['task_id']='task:other-role'
        elif variant=='both':row.update(task_id=event_role().task_references[0].id,requirement_skill_id=10)
        elif variant=='duplicate':out['skill_decisions'].append(copy.deepcopy(row))
        else:out['skill_decisions'].pop(0)
    result=generate(EventProvider(change))
    assert 'skill_relevance_incomplete' in result.notices
    assert {'Reading, writing and mathematics','Service orientation and customer service'}<=set(skill_names(result))

@pytest.mark.parametrize('error',[AIProviderError('synthetic',kind='timeout'),AIProviderError('synthetic',kind='transport')])
def test_fallback_only_standard_matches(error):
    provider=EventProvider(error=error); result=generate(provider)
    assert set(skill_names(result))=={'Reading, writing and mathematics','Service orientation and customer service'}
    assert result.outcome=='source_preserved' and len(provider.calls)==1
    assert all(link.method=='standard_mapping' for link in result.role_alignment.links)

def test_changed_role_reference_rejected_before_ai():
    original=source(); original['role_reference_fingerprint']='stale'; provider=EventProvider()
    with pytest.raises(GenerationFailure,match='reference changed'):generate(provider,original)
    assert provider.calls==[]

def test_task_ids_stable_in_same_role_and_not_reusable_in_other_roles():
    a=event_role(); b=OccupationRequirements(**{**a.model_dump(),'tasks':list(reversed(a.tasks))}); c=OccupationRequirements(**{**a.model_dump(),'occupation_code':'2421'})
    assert {t.id for t in a.task_references}=={t.id for t in b.task_references}
    assert not {t.id for t in a.task_references}&{t.id for t in c.task_references}
    assert a.reference_fingerprint!=b.reference_fingerprint

COURSES={cid:{'course_id':cid,'title':'Marketing communications as a strategic function','outcomes':outcomes,'source_fingerprint':curriculum_fingerprint(cid,'Marketing communications as a strategic function',outcomes,skill)} for cid,outcomes,skill in [('WEF-10-A-01','Demonstrate an understanding of the strategic importance of communications in a competitive environment.','Service orientation and customer service'),('WEF-20-A-02','Analyse marketing communications strategically; evaluate communication choices; connect messages, audiences and organisational objectives','Marketing and media')]}
async def loader(ids):return {cid:COURSES[cid] for cid in ids if cid in COURSES}
class CourseProvider:
    def __init__(self,transform=None):self.calls=[];self.transform=transform
    async def complete_json_async(self,**kwargs):
        self.calls.append(kwargs)
        output={'courses':[{'course_id':row['course_id'],'skills':[{'name':'Strategic marketing communications','quote':row['outcomes']}]} for row in kwargs['payload']['courses']]}
        if self.transform:self.transform(output)
        return output

def test_same_title_courses_keep_distinct_objectives_and_ids():
    provider=CourseProvider(); result=asyncio.run(identify_learning_skills(list(COURSES),provider,loader))
    assert [r.course_id for r in result.courses]==list(COURSES)
    assert result.courses[0].source_fingerprint!=result.courses[1].source_fingerprint
    assert len(provider.calls)==1 and 59 < provider.calls[0]['request_timeout_s'] <= 60
    assert all(row.skills[0].quote==COURSES[row.course_id]['outcomes'] for row in result.courses)

@pytest.mark.parametrize('variant',['borrowed_quote','proficiency','course_title','duplicate_course','missing_course','unknown_course'])
def test_invalid_curriculum_suggestions_report_without_fabricating(variant):
    def change(out):
        row=out['courses'][0]
        if variant=='borrowed_quote':row['skills'][0]['quote']=COURSES['WEF-20-A-02']['outcomes']
        elif variant=='proficiency':row['skills'][0]['name']='Expert marketing'
        elif variant=='course_title':row['skills'][0]['name']=COURSES[row['course_id']]['title']
        elif variant=='duplicate_course':out['courses'].append(copy.deepcopy(row))
        elif variant=='missing_course':out['courses'].pop(0)
        else:row['course_id']='unknown'
    result=asyncio.run(identify_learning_skills(list(COURSES),CourseProvider(change),loader))
    assert result.courses[0].skills==[] and 'invalid_suggestions' in result.courses[0].notices

def test_no_objectives_does_not_call_provider():
    async def empty(ids):return {'blank':{'course_id':'blank','title':'Blank','outcomes':'','source_fingerprint':'fingerprint'}}
    provider=CourseProvider(); result=asyncio.run(identify_learning_skills(['blank'],provider,empty))
    assert provider.calls==[] and result.courses[0].notices==['no_teaching_objectives']

def test_generation_rechecks_course_id_quote_and_fingerprint():
    original=source(); row=COURSES['WEF-20-A-02']; original['source_metadata']['course_skill_sources']=[{'skill_id':'user-17','course_id':row['course_id'],'quote':row['outcomes'],'source_fingerprint':row['source_fingerprint']}]
    request=GenerateRequest.model_validate(original); asyncio.run(validate_course_skill_sources(request,loader))
    for field,value in [('quote','Invented learning'),('course_id','unknown'),('source_fingerprint','old')]:
        bad=copy.deepcopy(original);bad['source_metadata']['course_skill_sources'][0][field]=value
        with pytest.raises(GenerationFailure):asyncio.run(validate_course_skill_sources(GenerateRequest.model_validate(bad),loader))

def test_course_request_cancellation_cancels_upstream():
    async def scenario():
        started=asyncio.Event();cancelled=asyncio.Event()
        class Slow:
            async def complete_json_async(self,**kwargs):
                started.set()
                try:await asyncio.Event().wait()
                except asyncio.CancelledError:cancelled.set();raise
        task=asyncio.create_task(identify_learning_skills(list(COURSES),Slow(),loader));await started.wait();task.cancel()
        with pytest.raises(asyncio.CancelledError):await task
        assert cancelled.is_set()
    asyncio.run(scenario())

def test_curriculum_timeout_no_retry(monkeypatch):
    import app.services.resume_learning as service
    monkeypatch.setattr(service,'BUDGET_SECONDS',.01)
    class Slow:
        calls=0
        async def complete_json_async(self,**kwargs):self.calls+=1;await asyncio.sleep(1)
    provider=Slow()
    with pytest.raises(GenerationFailure) as caught:asyncio.run(identify_learning_skills(list(COURSES),provider,loader))
    assert caught.value.code=='ai_timeout' and provider.calls==1

def assist_request():return AssistRequest(instruction='Add my skill',document={'cv':{'sections':{'Summary':['Reviewed background.']}}},skills=[{'id':'user-skill','name':'Negotiation'}],context_mode='auto_redacted')

def test_assistant_creates_missing_skills_from_candidates_only():
    req=assist_request();payload,originals,skills=compact_context(req,[])
    assert payload['sections'][-1]=={'section_index':1,'title':'Skills','entries':[]}
    raw={'message':'Added your selected skill.','sections':[{'section_index':1,'add_skills':['k0']}],'design':[]}
    result=assemble_assistance(CompactAssistResponse.model_validate(raw),req,originals,skills)
    assert result.sections[0].title=='Skills' and result.sections[0].entries[0].entry=={'bullet':'Negotiation'}
    assert req.document['cv']['sections']=={'Summary':['Reviewed background.']}
    raw['sections'][0]['add_skills']=['k9']
    with pytest.raises(GenerationRejected):assemble_assistance(CompactAssistResponse.model_validate(raw),req,originals,skills)

def test_learning_endpoint_auth_and_one_call():
    from app.routers.resume import router,get_resume_provider,get_resume_course_loader
    from app.services.auth import get_current_user
    app=FastAPI();app.include_router(router,prefix='/api/v1');provider=CourseProvider()
    app.dependency_overrides[get_current_user]=lambda:SimpleNamespace(id='synthetic')
    app.dependency_overrides[get_resume_provider]=lambda:provider
    app.dependency_overrides[get_resume_course_loader]=lambda:loader
    with TestClient(app) as client:
        response=client.post('/api/v1/resume/learning-skills',json={'course_ids':list(COURSES)})
        assert response.status_code==200 and len(provider.calls)==1
    app.dependency_overrides[get_current_user]=lambda:(_ for _ in ()).throw(__import__('fastapi').HTTPException(401,'Sign in'))
    with TestClient(app) as client:assert client.post('/api/v1/resume/learning-skills',json={'course_ids':list(COURSES)}).status_code==401

@pytest.mark.parametrize("invalid", [None, [None], {"text": "wrong shape"}, [None] * 501])
def test_invalid_polish_shape_preserves_valid_task_associations(invalid):
    result = generate(EventProvider(lambda out: out.update(patches=invalid)))
    assert "Negotiation" in skill_names(result)
    assert "unsupported_polish" in result.notices


def test_invalid_duplicate_decision_does_not_authorise_candidate():
    def change(output):
        decision = next(row for row in output["skill_decisions"] if row["task_id"] == event_role().task_references[1].id)
        output["skill_decisions"].append({"candidate_id": decision["candidate_id"], "requirement_skill_id": "invalid"})
    result = generate(EventProvider(change))
    assert "Negotiation" not in skill_names(result)
    assert "active listening" in skill_names(result)
    assert "skill_relevance_incomplete" in result.notices

def test_catalogue_lookup_shares_extraction_deadline(monkeypatch):
    import app.services.resume_learning as service
    monkeypatch.setattr(service, "BUDGET_SECONDS", .01)
    cancelled = []
    async def slow_loader(ids):
        try: await asyncio.sleep(1)
        finally: cancelled.append(True)
    provider = CourseProvider()
    with pytest.raises(GenerationFailure) as caught:
        asyncio.run(identify_learning_skills(list(COURSES), provider, slow_loader))
    assert caught.value.code == "ai_timeout" and provider.calls == [] and cancelled

def test_course_endpoint_disconnect_closes_real_async_http_client(monkeypatch):
    import httpx
    from app.services import ai_gateway
    from app.services.ai_gateway import OpenAICompatibleProvider
    from app.schemas.resume_learning import LearningSkillsRequest
    from app.routers.resume import learning_skills
    async def scenario():
        started, cancelled = asyncio.Event(), asyncio.Event()
        real, clients = httpx.AsyncClient, []
        async def handler(request):
            started.set()
            try: await asyncio.sleep(10)
            finally: cancelled.set()
        def client(**kwargs):
            value = real(transport=httpx.MockTransport(handler), **kwargs)
            clients.append(value)
            return value
        monkeypatch.setattr(ai_gateway.httpx, "AsyncClient", client)
        provider = OpenAICompatibleProvider(api_key="synthetic", model="synthetic", timeout_s=45, cache_size=0)
        async def receive():
            await started.wait()
            return {"type": "http.disconnect"}
        try:
            response = await learning_skills(LearningSkillsRequest(course_ids=list(COURSES)), SimpleNamespace(receive=receive), provider, loader)
            assert response.status_code == 499 and cancelled.is_set() and all(value.is_closed for value in clients)
        finally: provider.close()
    asyncio.run(scenario())

@pytest.mark.parametrize("kind,code,word", [("timeout", "ai_timeout", "timed out"), ("transport", "ai_connection_failed", "connect"), ("output", "ai_output_invalid", "invalid")])
def test_extraction_provider_errors_keep_specific_diagnostics(kind, code, word):
    class ErrorProvider:
        calls = 0
        async def complete_json_async(self, **kwargs):
            self.calls += 1
            raise AIProviderError("PRIVATE provider text", kind=kind)
    provider = ErrorProvider()
    with pytest.raises(GenerationFailure) as caught:
        asyncio.run(identify_learning_skills(list(COURSES), provider, loader))
    assert caught.value.code == code and word in caught.value.detail
    assert "PRIVATE" not in caught.value.detail and "skills are unchanged" in caught.value.detail and provider.calls == 1
