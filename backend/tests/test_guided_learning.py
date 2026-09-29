import asyncio
import copy
import json
from types import SimpleNamespace

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.db.session import get_db
from app.routers.accounts import current_account
from app.routers import guided_learning as router_module
from app.schemas.guided_learning import TaskSuggestionsRequest
from app.services import guided_learning as service

URI = 'http://data.europa.eu/esco/skill/b0565bd9-29c8-42f6-b174-702970fc2f4f'
TASK = {'id':'t1','wording':'I prepare monthly sales reports and handle customer complaints.'}
CONCEPT = {'uri':URI,'label':'produce sales reports','description':'Maintain records of products sold and sales volumes.',
           'skill_type':'skill','aliases':[],'relation':None,'source':'ESCO','version':'1.2.0'}
IDEA = {'goal':'Practise summarising a sample sales report','action':'Write a summary from fictional sales figures',
        'practice_idea':'Compare your summary with the fictional source figures.'}


def workspace(task=TASK):
    return {'aiwrevolusi.userProfile':json.dumps({'tasksConfirmed':True,'tasks':[task]})}


def extraction(quote='prepare monthly sales reports'):
    return {'activities':[{'task_quote':quote,'search_phrase':'produce sales reports'}],'coverage_limited':False}


def selection(quote='prepare monthly sales reports',uri=URI):
    return {'suggestions':[{'uri':uri,'task_quote':quote,'reason':'The definition covers recording sales volumes.',**IDEA}],'coverage_limited':False}


@pytest.fixture
def guided(monkeypatch):
    calls, searches = [], []
    responses = [extraction(),selection()]
    async def model(instructions,payload):
        calls.append(payload)
        response = responses.pop(0)
        if isinstance(response, Exception):raise response
        return response
    async def release(db):return {'version':'1.2.0'}
    async def search(db,**kwargs):
        searches.append(kwargs)
        return {'items':[CONCEPT],'version':'1.2.0'}
    monkeypatch.setattr(service,'model_json',model)
    monkeypatch.setattr(service,'require_release',release)
    monkeypatch.setattr(service,'search_catalogue',search)
    return responses,calls,searches


def test_full_task_pipeline_uses_two_calls_and_source_identity(guided):
    _,calls,searches=guided
    result=asyncio.run(service.task_suggestions(None,TASK))
    assert len(calls)==2 and calls[0]['full_confirmed_task']==TASK['wording']==calls[1]['full_confirmed_task']
    assert len(searches)==1 and searches[0]['limit']==8
    item=result['suggestions'][0]
    assert item['skill']==CONCEPT and item['task_quote'] in TASK['wording']
    assert item['action']['kind']=='practise' and item['practice_idea'].startswith('Use a fictional')
    assert result['status']=='suggestions' and result['prompt_version']=='guided-learning-v1'
    assert 'not expert-verified' in result['notice']
    assert 'attempts' not in result and 'proficiency' not in result


def test_later_activity_after_300_characters_is_not_truncated(guided):
    responses,calls,_=guided
    task={'id':'t1','wording':'I keep routine records for the office. '*15+'I prepare monthly sales reports.'}
    responses[:]=[extraction(),selection()]
    result=asyncio.run(service.task_suggestions(None,task))
    assert len(calls[0]['full_confirmed_task'])>300
    assert calls[0]['full_confirmed_task']==task['wording']
    assert result['suggestions'][0]['task_quote']=='prepare monthly sales reports'


def test_empty_supported_result_is_not_a_provider_failure(guided):
    responses,calls,_=guided;responses[:]=[{'activities':[],'coverage_limited':False}]
    result=asyncio.run(service.task_suggestions(None,TASK))
    assert result['status']=='no_supported_match' and len(calls)==1 and not result['suggestions']


@pytest.mark.parametrize('bad',[service.GuidedProviderUnavailable('offline'),{'activities':'bad','coverage_limited':False}])
def test_provider_or_malformed_output_is_unavailable(guided,bad):
    guided[0][:]=[bad]
    with pytest.raises(HTTPException) as exc:asyncio.run(service.task_suggestions(None,TASK))
    assert exc.value.status_code==503


@pytest.mark.parametrize('output',[selection(uri='http://example.com/invented'),selection(quote='invented evidence')])
def test_unknown_uri_and_unprovided_quote_are_rejected(guided,output):
    guided[0][1]=output
    with pytest.raises(HTTPException) as exc:asyncio.run(service.task_suggestions(None,TASK))
    assert exc.value.status_code==503


def test_extracted_quote_must_exist_in_saved_task(guided):
    guided[0][:]=[extraction('invented activity')]
    with pytest.raises(HTTPException) as exc:asyncio.run(service.task_suggestions(None,TASK))
    assert exc.value.status_code==503


@pytest.mark.parametrize('wording,quote',[
    ('I do not prepare monthly sales reports.','prepare monthly sales reports'),
    ('I never prepare monthly sales reports.','prepare monthly sales reports'),
    ('My manager prepares monthly sales reports.','prepares monthly sales reports'),
    ('I neither write reports nor administer medication.','administer medication'),
])
def test_negation_and_other_actor_guards(wording,quote):
    assert not service.supported_quote(wording,quote)


def test_negated_activity_does_not_trigger_retrieval(guided):
    responses,calls,searches=guided
    task={'id':'t1','wording':'I do not prepare monthly sales reports.'}
    responses[:]=[extraction()]
    result=asyncio.run(service.task_suggestions(None,task))
    assert result['status']=='no_supported_match' and result['coverage']['limited']
    assert not searches and len(calls)==1


def test_activity_and_candidate_bounds(guided):
    responses,calls,searches=guided
    task={'id':'t1','wording':'; '.join(f'activity {i}' for i in range(6))}
    activities=[{'task_quote':f'activity {i}','search_phrase':f'activity {i}'} for i in range(6)]
    responses[:]=[{'activities':activities,'coverage_limited':True},selection('activity 5')]
    result=asyncio.run(service.task_suggestions(None,task))
    assert len(searches)==6 and len(calls)==2 and result['coverage']['limited']
    assert len(calls[1]['candidates'])==1


def test_task_requires_owned_current_confirmed_record():
    assert service.saved_task(workspace(),'t1',TASK['wording'])==TASK
    for data,id,wording,status in [(workspace(),'other',TASK['wording'],404),(workspace(),'t1','old',409),({},'t1',TASK['wording'],409)]:
        with pytest.raises(HTTPException) as exc:service.saved_task(data,id,wording)
        assert exc.value.status_code==status
    with pytest.raises(ValidationError):TaskSuggestionsRequest(task_id='t1',expected_wording='x'*5001)


def personal_goal():
    return {'id':'g1','revision':1,'wording':'Understand my local reporting method','initial':{'skill':{'source':'personal','id':'p1','label':'Local method','sourceVersion':None},'tasks':[TASK],'career':None},'action':None}


def test_personal_goal_fallback_is_a_labelled_template_without_persistence(guided):
    goal=personal_goal();before=copy.deepcopy(goal);guided[0][:]=[service.GuidedProviderUnavailable('offline')]
    result=asyncio.run(service.goal_suggestion(None,goal))
    assert result['source']=='template' and 'unavailable' in result['notice']
    assert goal==before and 'attempts' not in result


def test_personal_goal_model_uses_saved_context_without_catalogue_claim(guided):
    guided[0][:]=[IDEA];goal=personal_goal()
    result=asyncio.run(service.goal_suggestion(None,goal))
    assert result['source']=='model' and result['revision']==1
    assert guided[1][0]['skill']['source']=='personal' and guided[1][0]['definition'] is None


def test_old_esco_version_uses_template_without_a_model_call(guided):
    goal=personal_goal();goal['initial']['skill']={'source':'esco','id':URI,'label':'Old label','sourceVersion':'old'}
    result=asyncio.run(service.goal_suggestion(None,goal))
    assert result['source']=='template' and not guided[1]


def test_unconfigured_provider_does_not_call_network(monkeypatch):
    monkeypatch.setattr(service.settings,'skill_llm_api_key',None)
    with pytest.raises(service.GuidedProviderUnavailable):asyncio.run(service.model_json('test',{}))


def test_task_route_checks_ownership_and_rechecks_context_after_generation(monkeypatch):
    app=FastAPI();app.include_router(router_module.router)
    account=SimpleNamespace(user_id='owner',workspace=workspace())
    async def owned():return account
    async def db():yield None
    async def suggest(_db,task):return {'task':task,'status':'no_supported_match','suggestions':[]}
    async def fresh(_db,_account):return SimpleNamespace(workspace=workspace({'id':'t1','wording':'Changed after request'}))
    app.dependency_overrides[current_account]=owned;app.dependency_overrides[get_db]=db
    monkeypatch.setattr(router_module,'task_suggestions',suggest);monkeypatch.setattr(router_module,'fresh_account',fresh)
    with TestClient(app) as client:
        assert client.post('/guided-learning/task-suggestions',json={'task_id':'other','expected_wording':TASK['wording']}).status_code==404
        assert client.post('/guided-learning/task-suggestions',json={'task_id':'t1','expected_wording':TASK['wording']}).status_code==409


def test_positive_activity_after_negated_clause_is_supported():
    task='I do not handle complaints, but I prepare monthly sales reports.'
    assert service.supported_quote(task,'prepare monthly sales reports')
    assert not service.supported_quote(task,'handle complaints')
    assert not service.supported_quote('I don’t administer medication.','administer medication')


def test_per_account_slot_rejects_overlap_and_releases_after_failure():
    account=SimpleNamespace(user_id='slot-owner')
    async def exercise():
        with pytest.raises(ValueError):
            async with router_module.generation_slot(account):
                with pytest.raises(HTTPException) as exc:
                    async with router_module.generation_slot(account):pass
                assert exc.value.status_code==429
                raise ValueError('failed')
        async with router_module.generation_slot(account):pass
    asyncio.run(exercise())
    assert 'slot-owner' not in router_module._active_accounts


def test_goal_context_checked_even_when_goal_revision_did_not_change():
    # Use the existing full saved-goal fixture rather than inventing an invalid
    # abbreviated goal that bypasses the actual account evidence contract.
    import runpy
    from pathlib import Path
    helpers=runpy.run_path(str(Path(__file__).with_name('test_learning_goals.py')))
    data=helpers['personal_workspace']()
    assert service.saved_goal(data,'g1',1)['id']=='g1'
    profile=json.loads(data['aiwrevolusi.userProfile'])
    profile['tasks'][0]['wording']='Changed task'
    data['aiwrevolusi.userProfile']=json.dumps(profile)
    with pytest.raises(HTTPException) as exc:service.saved_goal(data,'g1',1)
    assert exc.value.status_code==409


def test_provider_failure_has_one_attempt_and_no_sensitive_error(monkeypatch):
    calls=[]
    class Client:
        def __init__(self,**kwargs):assert kwargs['timeout'] <= 40
        async def __aenter__(self):return self
        async def __aexit__(self,*_args):pass
        async def post(self,*_args,**kwargs):
            calls.append(kwargs)
            raise service.httpx.ConnectError('private provider error')
    monkeypatch.setattr(service.settings,'skill_llm_api_key','test-secret-not-real')
    monkeypatch.setattr(service.httpx,'AsyncClient',Client)
    with pytest.raises(service.GuidedProviderUnavailable) as exc:asyncio.run(service.model_json('test',{'task':'saved task'}))
    assert len(calls)==1
    assert 'test-secret' not in str(exc.value) and 'private provider' not in str(exc.value)


def test_guided_routes_require_authentication():
    app=FastAPI();app.include_router(router_module.router)
    with TestClient(app) as client:
        assert client.post('/guided-learning/task-suggestions',json={'task_id':'t1','expected_wording':'Task'}).status_code==401
        assert client.post('/guided-learning/goal-suggestion',json={'goal_id':'g1','expected_revision':1}).status_code==401
