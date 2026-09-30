import asyncio
from copy import deepcopy
from datetime import datetime, timezone
import json
from pathlib import Path
import runpy
from types import SimpleNamespace
import uuid

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.db.session import get_db
from app.models.account import Account
from app.models.progress_review import ProgressReview
from app.routers.accounts import current_account
from app.routers import progress_reviews as routes
from app.services import progress_reviews as service

H=runpy.run_path(str(Path(__file__).with_name('test_learning_goals.py')))
KEY=H['KEY']


def data():return H['personal_workspace']()


def evidence(workspace):
    records=service.read_records(workspace)
    return service.current_evidence(records,{},'2026-09-30T00:00:00+00:00')


def review(workspace):
    snapshot=service.build_preview(service.read_records(workspace),{},1,recorded_at='2026-09-29T00:00:00+00:00')
    return SimpleNamespace(id=uuid.uuid4(),snapshot=snapshot,created_at=datetime.now(timezone.utc),previous_review_id=None)


def attempt(id='a1',kind='study'):
    return {'id':id,'date':'2026-01-01','type':kind,'description':'Tried one example','notes':'','task':{'id':'t1','wording':'Prepare reports'} if kind=='workplace_practice' else None,'createdAt':'2026-01-01T00:00:00Z','updatedAt':'2026-01-01T00:00:00Z'}


def add(workspace,id='a1',kind='study'):
    return H['changed'](workspace,lambda goal:goal['attempts'].append(attempt(id,kind)))


def test_first_review_is_a_starting_point_without_invented_earlier_counts():
    result=service.build_preview(service.read_records(data()),{},4)
    assert result['can_save'] and result['previous_review_id'] is None
    assert result['goals'][0]['status']=='starting_point' and result['goals'][0]['earlier'] is None
    assert result['summary']['with_study']==0 and result['summary']['goals_total']==1
    assert result['goals'][0]['current']['confirmed_tasks']==[{'id':'t1','wording':'Prepare reports'}]
    assert result['summary']['with_task_evidence']==0  # No claimed current use yet.


def test_new_attempt_is_new_evidence_and_does_not_rewrite_prior_snapshot():
    original=data();old=review(original);snapshot=deepcopy(old.snapshot)
    later=add(original)
    assert service.review_status(old.snapshot,evidence(later))[0]=='new_evidence_available'
    preview=service.build_preview(service.read_records(later),{},2,old)
    assert preview['goals'][0]['status']=='comparable'
    assert preview['goals'][0]['earlier']['study']==[]
    assert len(preview['goals'][0]['current']['study'])==1
    assert old.snapshot==snapshot


@pytest.mark.parametrize('change',['correct','remove'])
def test_old_review_is_immediately_invalidated_by_correction_or_removal(change):
    original=add(data());old=review(original)
    later=H['changed'](original,lambda g:g.update(attempts=[]) if change=='remove' else g['attempts'][0].update(description='Corrected description'))
    status,reasons=service.review_status(old.snapshot,evidence(later))
    assert status=='needs_review' and any('corrected or removed' in reason for reason in reasons)
    preview=service.build_preview(service.read_records(later),{},2,old)
    assert preview['required_reset_goal_ids']==['g1'] and preview['goals'][0]['status']=='needs_starting_point'


def test_new_goal_is_separate_and_does_not_invent_earlier_improvement():
    original=data();old=review(original);later=deepcopy(original)
    state=json.loads(later[KEY]);second=deepcopy(state['goals'][0]);second['id']='g2';state['goals'].append(second);later[KEY]=json.dumps(state)
    preview=service.build_preview(service.read_records(later),{},2,old)
    assert preview['goals'][1]['status']=='new_goal' and preview['goals'][1]['earlier'] is None
    assert preview['summary']['new_goals']==1
    assert service.review_status(old.snapshot,evidence(later))[0]=='new_evidence_available'


def test_goal_wording_requires_explicit_new_starting_point():
    original=data();old=review(original)
    later=H['changed'](original,lambda g:g.update(wording='Develop a different purpose'))
    preview=service.build_preview(service.read_records(later),{},2,old)
    assert preview['required_reset_goal_ids']==['g1'] and preview['goals'][0]['status']=='needs_starting_point'
    assert service.review_status(old.snapshot,evidence(later))[0]=='needs_review'


def test_changed_task_or_deleted_skill_blocks_a_new_starting_point():
    original=data();old=review(original)
    for kind in ('task','source'):
        later=deepcopy(original)
        if kind=='task':
            profile=json.loads(later[service.PROFILE_KEY]);profile['tasks'][0]['wording']='Changed task';later[service.PROFILE_KEY]=json.dumps(profile)
        else:
            journey=json.loads(later[service.JOURNEY_KEY]);journey['personalSkills']=[];later[service.JOURNEY_KEY]=json.dumps(journey)
        preview=service.build_preview(service.read_records(later),{},2,old)
        assert not preview['can_save'] and preview['goals'][0]['status']=='source_needs_review'
        assert service.review_status(old.snapshot,evidence(later))[0]=='needs_review'


def test_research_version_timestamp_and_unrelated_task_changes_do_not_reset_learning():
    original=data();old=review(original);later=deepcopy(original)
    profile=json.loads(later[service.PROFILE_KEY]);profile['analysis']={'sourceVersion':'future','meanScore2025':0.91};profile['tasks'].append({'id':'other','wording':'Arrange meetings'});later[service.PROFILE_KEY]=json.dumps(profile)
    journey=json.loads(later[service.JOURNEY_KEY]);journey['personalSkills'][0]['updatedAt']='2026-09-30T00:00:00Z';later[service.JOURNEY_KEY]=json.dumps(journey)
    before=deepcopy(later)
    preview=service.build_preview(service.read_records(later),{},2,old)
    assert preview['goals'][0]['status']=='comparable'
    assert service.review_status(old.snapshot,evidence(later))[0]=='current'
    assert later==before


def test_learning_interest_and_current_use_are_not_skill_meaning_changes():
    original=data();old=review(original);later=deepcopy(original)
    journey=json.loads(later[service.JOURNEY_KEY]);journey['personalSkills'][0].update(decision='use',wantsLearning=False);later[service.JOURNEY_KEY]=json.dumps(journey)
    preview=service.build_preview(service.read_records(later),{},2,old)
    assert preview['can_save'] and preview['goals'][0]['status']=='comparable'
    assert preview['summary']['with_task_evidence']==1 and preview['summary']['with_current_use']==1
    assert service.review_status(old.snapshot,evidence(later))[0]=='new_evidence_available'


def test_overlapping_counts_keep_study_course_and_workplace_attempts_separate():
    current=add(add(add(data(),'study','study'),'course','course_practice'),'work','workplace_practice')
    summary=service.build_preview(service.read_records(current),{},1)['summary']
    assert summary['goals_total']==1
    assert summary['with_study']==summary['with_course_practice']==summary['with_workplace_practice']==1
    assert summary['with_completed_learning']==0


def test_course_completion_requires_explicit_goal_link_and_does_not_invent_workplace_use():
    workspace=H['context_workspace']()
    journey=json.loads(workspace[service.JOURNEY_KEY]);journey['courseContexts']={'linked':'c1'};workspace[service.JOURNEY_KEY]=json.dumps(journey)
    workspace[service.PLAN_KEY]=json.dumps({'version':1,'courses':[{'id':id,'title':id,'chapters':[{'title':'Part one','value':10}]} for id in ['linked','unlinked']],'records':{}})
    records=service.read_records(workspace)
    result=service.build_preview(records,{('wef','1',None):True},1)
    item=result['goals'][0]['current']
    assert [c['id'] for c in item['completed_learning']]==['linked']
    assert item['completed_learning'][0]['completed_at'] is None
    assert not item['workplace_practice'] and result['summary']['with_workplace_practice']==0
    assert any('completion date' in gap for gap in item['gaps'])


@pytest.mark.parametrize('key,value',[(KEY,'null'),(service.PROFILE_KEY,'{"tasks":null}'),(service.PLAN_KEY,'{"version":1,"courses":null,"records":{}}'),(service.JOURNEY_KEY,'bad')])
def test_invalid_source_is_not_an_empty_success(key,value):
    workspace=data();workspace[key]=value
    with pytest.raises(HTTPException) as exc:service.read_records(workspace)
    assert exc.value.status_code==422


@pytest.fixture
def client(monkeypatch):
    engine=create_engine('sqlite://',connect_args={'check_same_thread':False},poolclass=StaticPool)
    Account.__table__.create(engine);ProgressReview.__table__.create(engine)
    session=Session(engine,expire_on_commit=False)
    owner=uuid.uuid4();account=Account(user_id=owner,username='review-test',workspace=data(),revision=1)
    session.add(account);session.commit()
    class DB:
        async def scalar(self,q):return session.scalar(q)
        async def scalars(self,q):return session.scalars(q)
        async def execute(self,q):return session.execute(q)
        def add(self,row):session.add(row)
        async def flush(self):session.flush()
        async def refresh(self,row):session.refresh(row)
        async def commit(self):session.commit()
    async def db():yield DB()
    async def owned():return account
    async def checked(_db,_goals):return {}
    monkeypatch.setattr(service,'catalogue_checks',checked)
    app=FastAPI();app.include_router(routes.router);app.dependency_overrides[get_db]=db;app.dependency_overrides[current_account]=owned
    with TestClient(app) as http:yield http,session,account
    session.close();engine.dispose()


def body(revision=1,previous=None):
    return {'request_id':str(uuid.uuid4()),'expected_workspace_revision':revision,'expected_previous_review_id':previous,'reset_goal_ids':[]}


def test_preview_and_history_never_save_and_post_is_idempotent(client):
    http,session,account=client
    assert http.get('/progress-reviews/preview').json()['can_save']
    assert http.get('/progress-reviews').json()['total']==0
    payload=body();first=http.post('/progress-reviews',json=payload)
    assert first.status_code==201,first.text
    saved=first.json();assert saved['snapshot']['goals'][0]['earlier'] is None
    assert http.post('/progress-reviews',json=payload).json()['id']==saved['id']
    assert http.get('/progress-reviews').json()['total']==1
    assert 'snapshot' not in http.get('/progress-reviews').json()['items'][0]
    assert account.revision==1  # Review creation never writes workspace evidence.
    changed={**payload,'expected_workspace_revision':2}
    assert http.post('/progress-reviews',json=changed).status_code==409


def test_expected_workspace_and_previous_review_block_stale_or_concurrent_requests(client):
    http,_,_=client
    assert http.post('/progress-reviews',json=body(revision=0)).status_code==409
    saved=http.post('/progress-reviews',json=body()).json()
    assert http.post('/progress-reviews',json=body()).status_code==409
    next=http.post('/progress-reviews',json=body(previous=saved['id']))
    assert next.status_code==201
    assert next.json()['snapshot']['goals'][0]['status']=='comparable'


def test_read_recomputes_invalid_status_without_modifying_saved_snapshot(client):
    http,session,account=client
    account.workspace=add(account.workspace);session.commit()
    saved=http.post('/progress-reviews',json=body()).json();snapshot=deepcopy(saved['snapshot'])
    account.workspace=H['changed'](account.workspace,lambda g:g.update(attempts=[]));account.revision=2;session.commit()
    latest=http.get('/progress-reviews/'+saved['id']).json()
    assert latest['status']=='needs_review' and latest['snapshot']==snapshot
    assert http.get('/progress-reviews').json()['items'][0]['status']=='needs_review'


def test_reset_requires_explicit_exact_goal_confirmation(client):
    http,session,account=client
    saved=http.post('/progress-reviews',json=body()).json()
    account.workspace=H['changed'](account.workspace,lambda g:g.update(wording='Different goal'));account.revision=2;session.commit()
    pending=body(2,saved['id'])
    assert http.post('/progress-reviews',json=pending).status_code==409
    pending['reset_goal_ids']=['g1'];response=http.post('/progress-reviews',json=pending)
    assert response.status_code==201,response.text
    assert response.json()['snapshot']['goals'][0]['earlier'] is None
    assert http.get('/progress-reviews/'+saved['id']).json()['status']=='needs_review'


def test_history_is_account_scoped_and_paginated(client):
    http,session,account=client
    saved=http.post('/progress-reviews',json=body()).json()
    assert http.get('/progress-reviews?limit=1&offset=1').json()['items']==[]
    other=Account(user_id=uuid.uuid4(),username='other',workspace=data(),revision=1);session.add(other);session.commit()
    async def owned():return other
    http.app.dependency_overrides[current_account]=owned
    assert http.get('/progress-reviews').json()['total']==0
    assert http.get('/progress-reviews/'+saved['id']).status_code==404


def test_stale_old_goal_does_not_block_review_of_a_new_valid_goal():
    workspace=data()
    state=json.loads(workspace[KEY]);old=state['goals'][0];new=deepcopy(old);new['id']='g2';new['sourceKey']='personal:p2';new['initial']['skill'].update(id='p2',label='New report method');new['initial']['wording']='Develop New report method';new['wording']=new['initial']['wording'];state['goals'].append(new)
    workspace[KEY]=json.dumps(state)
    journey=json.loads(workspace[service.JOURNEY_KEY]);journey['personalSkills']=[{**journey['personalSkills'][0],'id':'p2','name':'New report method'}];workspace[service.JOURNEY_KEY]=json.dumps(journey)
    records=service.read_records(workspace);preview=service.build_preview(records,{},3)
    assert preview['can_save']
    assert [g['status'] for g in preview['goals']]==['source_needs_review','starting_point']
    assert preview['summary']['goals_total']==2 and preview['summary']['excluded_goals']==1
    assert service.review_status(preview,service.current_evidence(records,{},service.stamp()))[0]=='current'


def test_optional_course_absence_does_not_turn_valid_practice_into_a_gap_count():
    current=add(data(),'a1','workplace_practice')
    preview=service.build_preview(service.read_records(current),{},1)
    assert preview['summary']['with_workplace_practice']==1
    assert preview['summary']['with_completed_learning']==0
    assert preview['summary']['needing_evidence']==0


def test_next_step_uses_recorded_activity_without_inventing_ability():
    from app.services.progress_reviews import suggested_next_step
    item = {'source_valid': True, 'workplace_practice': [], 'course_practice': [], 'study': [], 'completed_learning': []}
    assert 'prepared starting activity' in suggested_next_step(item)
    item['study'] = [{'id': 'study'}]
    assert 'sample exercise' in suggested_next_step(item).lower()
    item['workplace_practice'] = [{'id': 'attempt'}]
    assert 'repeat or adjust' in suggested_next_step(item)
    item['source_valid'] = False
    assert 'Review this goal' in suggested_next_step(item)
