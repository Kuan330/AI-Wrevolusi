import copy
import json
from uuid import uuid4
import pytest
from pydantic import ValidationError
from app.routers.accounts import WorkspaceUpdate
from app.services.learning_goals import LEARNING_GOALS_KEY as KEY, validate_learning_goals, validate_learning_goal_transition


def workspace():
    entry = {'taskId':'t1','taskWording':'Prepare reports','occupationCode':'3115','skillUri':'http://data.europa.eu/esco/skill/12345678-1234-1234-1234-123456789abc','skillLabel':'Write reports','sourceVersion':'1.2.0','decision':None,'wantsLearning':True,'updatedAt':'2026-01-01T00:00:00Z'}
    goal = {'id':'g1','sourceKey':'specialist:'+json.dumps(['t1',entry['skillUri']],separators=(',',':')),'createdAt':'2026-01-01T00:00:00Z','updatedAt':'2026-01-01T00:00:00Z','wording':'Develop Write reports','action':None,'attempts':[],'history':[],'revision':1,'needsReview':False,
            'initial':{'skill':{'source':'esco','id':entry['skillUri'],'label':entry['skillLabel'],'sourceVersion':'1.2.0'},'decision':None,'tasks':[{'id':'t1','wording':'Prepare reports'}],'occupationCode':'3115','sourceOccupationUri':None,'career':None,'origin':'work','workKey':None,'wording':'Develop Write reports'}}
    return {KEY:json.dumps({'version':1,'goals':[goal]}),'aiwrevolusi.specialistSkills.v1':json.dumps({'version':1,'entries':[entry],'focusKey':None}),'aiwrevolusi.userProfile':json.dumps({'tasksConfirmed':True,'tasksOccupationCode':'3115','tasks':[{'id':'t1','wording':'Prepare reports'}]})}


def changed(data, change):
    data=copy.deepcopy(data)
    state=json.loads(data[KEY]);g=state['goals'][0]
    g['history'].append({k:copy.deepcopy(g[k]) for k in ('revision','wording','action','attempts')}|{'recordedAt':'2026-01-02T00:00:00Z'})
    g['revision']+=1;g['needsReview']=True
    change(g)
    data[KEY]=json.dumps(state)
    return data


def test_creation_and_validated_workspace_key():
    data=workspace()
    WorkspaceUpdate(owner_id=uuid4(),revision=0,data=data)
    validate_learning_goal_transition({},data)


def test_study_without_action_and_correct_remove_keeps_history():
    data=workspace()
    a={'id':'a1','date':'2026-01-01','type':'study','description':'Read a guide','notes':'','task':None,'createdAt':'2026-01-01T00:00:00Z','updatedAt':'2026-01-01T00:00:00Z'}
    second=changed(data,lambda g:g['attempts'].append(a));validate_learning_goal_transition(data,second)
    third=changed(second,lambda g:g['attempts'][0].update(description='Read chapter one'));validate_learning_goal_transition(second,third)
    fourth=changed(third,lambda g:g.update(attempts=[]));validate_learning_goal_transition(third,fourth)
    assert json.loads(fourth[KEY])['goals'][0]['history'][-1]['attempts'][0]['description']=='Read chapter one'


@pytest.mark.parametrize('patch',[{'initial':{}},{'revision':True},{'needsReview':'yes'},{'proficiency':100}])
def test_invalid_record_is_rejected(patch):
    data=workspace();state=json.loads(data[KEY]);state['goals'][0].update(patch)
    with pytest.raises(ValueError):validate_learning_goals(state)
    data[KEY]=json.dumps(state)
    with pytest.raises(ValidationError):WorkspaceUpdate(owner_id=uuid4(),revision=0,data=data)


def test_cannot_rewrite_baseline_erase_goal_or_skip_history():
    data=workspace()
    for change in [lambda g:g['initial'].update(wording='Altered baseline'),lambda g:g.update(history=[]),lambda g:g.update(needsReview=False)]:
        with pytest.raises(ValueError):validate_learning_goal_transition(data,changed(data,change))
    empty=copy.deepcopy(data);del empty[KEY]
    with pytest.raises(ValueError):validate_learning_goal_transition(data,empty)


def test_discovery_role_never_becomes_career_reason():
    data=workspace();state=json.loads(data[KEY]);state['goals'][0]['initial']['career']={'code':'123','title':'Invented career'};data[KEY]=json.dumps(state)
    with pytest.raises(ValueError):validate_learning_goal_transition({},data)


def test_real_task_and_future_dates_validated():
    data=workspace()
    a={'id':'a1','date':'2026-01-01','type':'workplace_practice','description':'Tried it','notes':'','task':{'id':'missing','wording':'Invented'},'createdAt':'2026-01-01T00:00:00Z','updatedAt':'2026-01-01T00:00:00Z'}
    with pytest.raises(ValueError):validate_learning_goal_transition(data,changed(data,lambda g:g['attempts'].append(a)))
    a.update(type='study',task=None,date='2999-01-01')
    with pytest.raises(ValueError):validate_learning_goal_transition(data,changed(data,lambda g:g['attempts'].append(a)))


def test_removed_attempt_id_cannot_be_reused():
    data=workspace();a={'id':'a1','date':'2026-01-01','type':'study','description':'Read','notes':'','task':None,'createdAt':'2026-01-01T00:00:00Z','updatedAt':'2026-01-01T00:00:00Z'}
    second=changed(data,lambda g:g['attempts'].append(a));third=changed(second,lambda g:g.update(attempts=[]))
    with pytest.raises(ValueError):validate_learning_goal_transition(third,changed(third,lambda g:g['attempts'].append(a)))


def context_workspace(origin='work'):
    data=workspace()
    context={'id':'c1','origin':origin,'skill':{'source':'wef','id':1,'slug':'thinking','name':'Thinking'},'taskIds':['t1'],'taskLabels':['Prepare reports'],'goal':'Develop thinking','workKey':json.dumps({'occupationCode':'3115','tasks':[{'id':'t1','wording':'Prepare reports'}]}),'createdAt':'2026-01-01T00:00:00Z'}
    if origin=='career':context['career']={'code':'1234','title':'Future role'}
    data['aiwrevolusi.journey.v1']=json.dumps({'version':1,'contexts':{'c1':context},'courseContexts':{},'review':{'workKey':context['workKey'],'decisions':{'1':'accepted'},'completed':True,'updatedAt':context['createdAt']}})
    state=json.loads(data[KEY]);g=state['goals'][0];g['sourceKey']='context:c1';g['wording']='Develop thinking'
    g['initial']={'skill':{'source':'wef','id':'1','label':'Thinking','sourceVersion':None},'decision':'accepted' if origin=='work' else None,'tasks':[{'id':'t1','wording':'Prepare reports'}],'occupationCode':None,'sourceOccupationUri':None,'career':context.get('career'),'origin':origin,'workKey':context['workKey'],'wording':'Develop thinking'}
    data[KEY]=json.dumps(state)
    return data


def test_wef_goal_requires_accepted_choice_and_real_work():
    data=context_workspace();validate_learning_goal_transition({},data)
    journey=json.loads(data['aiwrevolusi.journey.v1']);journey['review']['decisions']['1']='rejected';data['aiwrevolusi.journey.v1']=json.dumps(journey)
    with pytest.raises(ValueError):validate_learning_goal_transition({},data)


def test_career_snapshot_requires_current_work_but_keeps_sourced_reason():
    data=context_workspace('career');validate_learning_goal_transition({},data)
    profile=json.loads(data['aiwrevolusi.userProfile']);profile['tasks'][0]['wording']='Changed task';data['aiwrevolusi.userProfile']=json.dumps(profile)
    with pytest.raises(ValueError):validate_learning_goal_transition({},data)


@pytest.mark.parametrize('profile',[[],None,{'tasks':None},{'tasks':[None]}])
def test_malformed_profile_rejects_with_validation_error(profile):
    data=workspace();data['aiwrevolusi.userProfile']=json.dumps(profile)
    with pytest.raises(ValueError):validate_learning_goal_transition({},data)


def personal_workspace():
    data = workspace()
    profile = json.loads(data['aiwrevolusi.userProfile'])
    entry = {'id':'p1','name':'My local reporting method','taskIds':['t1'],'taskLabels':['Prepare reports'],
             'workKey':json.dumps({'occupationCode':'3115','tasks':profile['tasks']}),'updatedAt':'2026-01-01T00:00:00Z','wantsLearning':True}
    data['aiwrevolusi.journey.v1'] = json.dumps({'version':1,'contexts':{},'courseContexts':{},'personalSkills':[entry]})
    state=json.loads(data[KEY]); g=state['goals'][0]
    g['sourceKey']='personal:p1';g['wording']='Develop '+entry['name']
    g['initial']={'skill':{'source':'personal','id':'p1','label':entry['name'],'sourceVersion':None},'decision':None,
                  'tasks':[{'id':'t1','wording':'Prepare reports'}],'occupationCode':None,'sourceOccupationUri':None,
                  'career':None,'origin':'work','workKey':entry['workKey'],'wording':g['wording']}
    data[KEY]=json.dumps(state)
    return data


def test_personal_goal_keeps_user_source_without_inventing_catalogue_or_ability():
    data=personal_workspace();WorkspaceUpdate(owner_id=uuid4(),revision=0,data=data);validate_learning_goal_transition({},data)
    goal=json.loads(data[KEY])['goals'][0]
    assert goal['initial']['skill']['source']=='personal'
    assert goal['initial']['decision'] is None and goal['initial']['career'] is None
    validate_learning_goal_transition(data,changed(data,lambda g:g.update(action={'kind':'practise','text':'Try my method'})))


@pytest.mark.parametrize('change', ['interest','task','label','source','career','decision'])
def test_personal_goal_requires_saved_choice_and_exact_context(change):
    data=personal_workspace();state=json.loads(data[KEY]);journey=json.loads(data['aiwrevolusi.journey.v1'])
    if change=='interest':journey['personalSkills'][0]['wantsLearning']=False
    elif change=='task':
        profile=json.loads(data['aiwrevolusi.userProfile']);profile['tasks'][0]['wording']='Changed';data['aiwrevolusi.userProfile']=json.dumps(profile)
    elif change=='label':state['goals'][0]['initial']['skill']['label']='Different skill'
    elif change=='source':state['goals'][0]['initial']['skill']['source']='wef'
    elif change=='career':state['goals'][0]['initial']['career']={'code':'1234','title':'Invented'}
    elif change=='decision':state['goals'][0]['initial']['decision']='use'
    data[KEY]=json.dumps(state);data['aiwrevolusi.journey.v1']=json.dumps(journey)
    with pytest.raises(ValueError):validate_learning_goal_transition({},data)


def test_personal_goal_ignores_unrelated_work_changes():
    data=personal_workspace();profile=json.loads(data['aiwrevolusi.userProfile'])
    profile['tasks'].append({'id':'t2','wording':'Arrange deliveries'})
    data['aiwrevolusi.userProfile']=json.dumps(profile)
    validate_learning_goal_transition({},data)


@pytest.mark.parametrize('origin', ['ai_suggestion', 'template'])
def test_action_origin_survives_corrections_without_claiming_verified_advice(origin):
    data = workspace()
    second = changed(data, lambda g: g.update(action={'kind': 'practise', 'text': 'Try a fictional example', 'origin': origin}))
    validate_learning_goal_transition(data, second)
    third = changed(second, lambda g: g.update(action=None))
    validate_learning_goal_transition(second, third)
    assert json.loads(third[KEY])['goals'][0]['history'][-1]['action']['origin'] == origin


@pytest.mark.parametrize('origin', ['verified', ['ai_suggestion'], None])
def test_action_cannot_claim_an_unsupported_origin(origin):
    state = json.loads(workspace()[KEY])
    state['goals'][0]['action'] = {'kind': 'practise', 'text': 'Try an example', 'origin': origin}
    with pytest.raises(ValueError):
        validate_learning_goals(state)


def compact_state(value):
    """Fixture encoder for the frontend v2 wire format."""
    result = {'version': 2, 'goals': []}
    for original in value['goals']:
        goal = copy.deepcopy(original)
        pool, indexes = [], {}
        def refs(items):
            references = []
            for item in items:
                key = json.dumps(item, sort_keys=True, separators=(',', ':'))
                if key not in indexes:
                    indexes[key] = len(pool)
                    pool.append(item)
                references.append(indexes[key])
            return references
        for history in goal['history']:
            history['attemptRefs'] = refs(history.pop('attempts'))
        goal['attemptRefs'] = refs(goal.pop('attempts'))
        goal['attemptPool'] = pool
        result['goals'].append(goal)
    return result


def compact_workspace(data):
    result = copy.deepcopy(data)
    result[KEY] = json.dumps(compact_state(validate_learning_goals(json.loads(data[KEY]))), separators=(',', ':'))
    return result


def test_compact_read_is_lossless_and_does_not_mutate_storage():
    data = workspace()
    attempt = {'id':'a1','date':'2026-01-01','type':'study','description':'Original study','notes':'Context','task':None,'createdAt':'2026-01-01T00:00:00Z','updatedAt':'2026-01-01T00:00:00Z'}
    second = changed(data, lambda g: g['attempts'].append(attempt))
    third = changed(second, lambda g: g.update(wording='Edited wording'))
    compact = compact_state(json.loads(third[KEY]))
    before = copy.deepcopy(compact)
    assert validate_learning_goals(compact) == json.loads(third[KEY])
    assert compact == before
    assert len(compact['goals'][0]['attemptPool']) == 1
    validate_learning_goal_transition(second, compact_workspace(third))
    validate_learning_goal_transition(compact_workspace(second), compact_workspace(third))
    # A serialization change alone does not alter the semantic record.
    validate_learning_goal_transition(third, compact_workspace(third))


def test_new_compact_goal_keeps_source_and_initial_state_checks():
    data = compact_workspace(workspace())
    validate_learning_goal_transition({}, data)
    WorkspaceUpdate(owner_id=uuid4(), revision=0, data=data)
    forged = copy.deepcopy(data)
    state = json.loads(forged[KEY])
    state['goals'][0]['initial']['skill']['label'] = 'Invented skill'
    forged[KEY] = json.dumps(state)
    with pytest.raises(ValueError):
        validate_learning_goal_transition({}, forged)


@pytest.mark.parametrize('corrupt', [
    lambda g: g['attemptRefs'].append(999),
    lambda g: g['attemptRefs'].append(0),
    lambda g: g['attemptRefs'].__setitem__(0, True),
    lambda g: g['attemptPool'].append(g['attemptPool'][0] | {'id':'unused'}),
    lambda g: g['attemptPool'].append(copy.deepcopy(g['attemptPool'][0])),
])
def test_compact_pool_references_are_checked(corrupt):
    data = workspace()
    a = {'id':'a1','date':'2026-01-01','type':'study','description':'Original','notes':'','task':None,'createdAt':'2026-01-01T00:00:00Z','updatedAt':'2026-01-01T00:00:00Z'}
    state = compact_state(json.loads(changed(data, lambda g:g['attempts'].append(a))[KEY]))
    corrupt(state['goals'][0])
    with pytest.raises(ValueError):
        validate_learning_goals(state)


def test_forged_pool_or_history_reference_cannot_rewrite_past_evidence():
    data = workspace()
    a = {'id':'a1','date':'2026-01-01','type':'study','description':'Original','notes':'','task':None,'createdAt':'2026-01-01T00:00:00Z','updatedAt':'2026-01-01T00:00:00Z'}
    second = changed(data, lambda g:g['attempts'].append(a))
    third = changed(second, lambda g:g.update(wording='New wording'))
    for corrupt in [lambda g:g['attemptPool'][0].update(description='Rewritten past'), lambda g:g['history'][-1].update(attemptRefs=[]), lambda g:g['initial'].update(wording='New baseline')]:
        forged = compact_workspace(third)
        state = json.loads(forged[KEY]); corrupt(state['goals'][0]); forged[KEY] = json.dumps(state)
        with pytest.raises(ValueError):
            validate_learning_goal_transition(compact_workspace(second), forged)


def test_compact_removal_still_prevents_resurrection():
    data=workspace()
    a={'id':'a1','date':'2026-01-01','type':'study','description':'Original','notes':'','task':None,'createdAt':'2026-01-01T00:00:00Z','updatedAt':'2026-01-01T00:00:00Z'}
    second=changed(data,lambda g:g['attempts'].append(a));third=changed(second,lambda g:g.update(attempts=[]))
    with pytest.raises(ValueError):
        validate_learning_goal_transition(compact_workspace(third),compact_workspace(changed(third,lambda g:g['attempts'].append(a))))


def test_compact_history_supports_100_long_attempts_and_220_edits_under_workspace_limit():
    state=json.loads(workspace()[KEY]);g=state['goals'][0]
    for i in range(220):
        g['history'].append({key:copy.deepcopy(g[key]) for key in ('revision','wording','action','attempts')} | {'recordedAt':g['createdAt']})
        g['revision'] += 1;g['needsReview']=True
        if i < 100:
            g['attempts'].append({'id':f'a{i}','date':'2026-01-01','type':'study','description':f'Entry {i}: '+('d'*1900),'notes':'n'*3900,'task':None,'createdAt':g['createdAt'],'updatedAt':g['updatedAt']})
        else:
            g['wording']=f'Revised goal {i}'
    compact=compact_state(state)
    data={KEY:json.dumps(compact,separators=(',',':'))}
    assert len(json.dumps(data)) < 2_000_000
    WorkspaceUpdate(owner_id=uuid4(),revision=0,data=data)
    assert validate_learning_goals(compact) == state
    assert len(compact['goals'][0]['attemptPool']) == 100
    # Historical repeated prose no longer counts against every saved version.
    assert len(json.dumps(state)) > 2_000_000


def test_revision_capacity_failure_explains_limit_and_never_prunes():
    state=json.loads(workspace()[KEY]);g=state['goals'][0]
    g['revision']=1001;g['history']=[{'revision':i+1,'recordedAt':g['createdAt'],'wording':g['wording'],'action':None,'attempts':[]} for i in range(1000)]
    for raw in [state,compact_state(state)]:
        before=copy.deepcopy(raw)
        with pytest.raises(ValueError, match='history limit of 1000'):
            validate_learning_goals(raw)
        assert raw == before
