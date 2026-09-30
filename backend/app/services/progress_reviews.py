"""Dated, explicit reviews of recorded evidence. No scores or inferred competence."""
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import json

from fastapi import HTTPException
from sqlalchemy import select, text

from app.models.specialist import SpecialistConcept
from app.services.journey import validate_journey
from app.services.learning_goals import LEARNING_GOALS_KEY, validate_learning_goals
from app.services.specialist_review import validate_specialist_review

PROFILE_KEY = 'aiwrevolusi.userProfile'
JOURNEY_KEY = 'aiwrevolusi.journey.v1'
SPECIALIST_KEY = 'aiwrevolusi.specialistSkills.v1'
PLAN_KEY = 'aiwrevolusi.plan.courses.v1'
NOTICE = ('These counts describe your saved records, not assessed ability or job readiness. '
          'One goal can appear in several counts. Course completion does not prove workplace use. '
          'Missing records are not missing ability, and courses remain optional. AI research scores are not changed by this review.')


def stamp():
    return datetime.now(timezone.utc).isoformat()


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()


def read_json(workspace, key, default):
    try:
        value = json.loads(workspace[key]) if key in workspace else deepcopy(default)
        if not isinstance(value, dict):
            raise ValueError()
        return value
    except (ValueError, TypeError) as error:
        raise HTTPException(422, 'Saved progress source data could not be read. Review your account records before saving a comparison.') from error


def read_records(workspace):
    try:
        profile = read_json(workspace, PROFILE_KEY, {'tasks':[], 'tasksConfirmed':False})
        tasks = profile.get('tasks', [])
        if not isinstance(tasks, list) or any(not isinstance(t, dict) or not isinstance(t.get('id'),str) or not isinstance(t.get('wording'),str) for t in tasks):
            raise ValueError()
        goals = validate_learning_goals(read_json(workspace, LEARNING_GOALS_KEY, {'version':1,'goals':[]}))['goals']
        journey = validate_journey(read_json(workspace, JOURNEY_KEY, {'version':1,'contexts':{},'courseContexts':{}}))
        specialist = validate_specialist_review(read_json(workspace, SPECIALIST_KEY, {'version':1,'entries':[],'focusKey':None}))
        plan = read_json(workspace, PLAN_KEY, {'version':1,'courses':[],'records':{}})
        if type(plan.get('version')) is not int or plan.get('version') != 1 or not isinstance(plan.get('courses'),list) or not isinstance(plan.get('records'),dict):
            raise ValueError()
        seen = set()
        for course in plan['courses']:
            if not isinstance(course,dict) or not isinstance(course.get('id'),str) or course['id'] in seen or not isinstance(course.get('title'),str) or not isinstance(course.get('chapters'),list):
                raise ValueError()
            seen.add(course['id'])
            for chapter in course['chapters']:
                if not isinstance(chapter,dict) or not isinstance(chapter.get('title'),str) or type(chapter.get('value')) is not int or not 0 <= chapter['value'] <= 10:
                    raise ValueError()
        for date, record in plan['records'].items():
            if not isinstance(record,dict) or not isinstance(record.get('entries',[]),list):
                raise ValueError()
            datetime.strptime(date,'%Y-%m-%d')
            for entry in record.get('entries',[]):
                if not isinstance(entry,dict) or not isinstance(entry.get('courseId'),str) or not isinstance(entry.get('chapterTitle'),str) or type(entry.get('percent')) not in (int,float) or not 0 <= entry['percent'] <= 100:
                    raise ValueError()
        return {'profile':profile,'goals':goals,'journey':journey,'specialist':specialist,'plan':plan}
    except (ValueError, TypeError, KeyError, AttributeError) as error:
        raise HTTPException(422, 'Saved progress source data is invalid. It has not been replaced with empty records.') from error


async def catalogue_checks(db, goals):
    """Check claimed reference identity without assigning personal competence."""
    result = {}
    esco = [g['initial']['skill'] for g in goals if g['initial']['skill']['source']=='esco']
    if esco:
        rows = (await db.execute(select(SpecialistConcept.__table__).where(SpecialistConcept.uri.in_([s['id'] for s in esco])))).mappings().all()
        indexed = {(r['uri'],r['version']):r['label'] for r in rows}
        for skill in esco:
            result[('esco',skill['id'],skill['sourceVersion'])] = indexed.get((skill['id'],skill['sourceVersion'])) == skill['label']
    wef = [g['initial']['skill'] for g in goals if g['initial']['skill']['source']=='wef']
    if wef:
        rows = (await db.execute(text('SELECT wef_skill_id, core_skill FROM ref_wef_skills'))).mappings().all()
        indexed = {str(r['wef_skill_id']):r['core_skill'] for r in rows}
        for skill in wef:
            result[('wef',skill['id'],None)] = indexed.get(skill['id']) == skill['label']
    return result


def resolve_source(goal, records, checked):
    initial = goal['initial']; skill = initial['skill']; key = goal['sourceKey']
    expected_tasks = initial['tasks']
    source_tasks = []; decision = None; valid = True
    if skill['source']=='esco':
        source = next((e for e in records['specialist']['entries'] if 'specialist:'+json.dumps([e['taskId'],e['skillUri']],separators=(',',':'),ensure_ascii=False)==key),None)
        valid = bool(source and source['skillUri']==skill['id'] and source['skillLabel']==skill['label'] and source['sourceVersion']==skill['sourceVersion'] and source['occupationCode']==initial['occupationCode'] and source.get('sourceOccupationUri')==initial['sourceOccupationUri'])
        if source:
            source_tasks=[{'id':source['taskId'],'wording':source['taskWording']}];decision=source['decision']
    elif skill['source']=='personal':
        source = next((e for e in records['journey'].get('personalSkills',[]) if 'personal:'+e['id']==key),None)
        valid = bool(source and source['id']==skill['id'] and source['name']==skill['label'])
        if source:
            source_tasks=[{'id':i,'wording':w} for i,w in zip(source['taskIds'],source['taskLabels'])];decision=source.get('decision')
    else:
        source = records['journey']['contexts'].get(key[8:]) if key.startswith('context:') else None
        valid = bool(source and str(source['skill']['id'])==skill['id'] and source['skill']['name']==skill['label'] and source['origin']==initial['origin'] and source.get('career')==initial['career'])
        if source:
            source_tasks=[{'id':i,'wording':w} for i,w in zip(source['taskIds'],source['taskLabels'])]
            decision=records['journey'].get('review',{}).get('decisions',{}).get(skill['id']) if initial['origin']=='work' else None
    if skill['source']!='personal' and not checked.get((skill['source'],skill['id'],skill['sourceVersion']),False):
        valid=False
    if source_tasks != expected_tasks:
        valid=False
    current_tasks={t['id']:t['wording'] for t in records['profile'].get('tasks',[])}
    if expected_tasks and (records['profile'].get('tasksConfirmed') is not True or any(current_tasks.get(t['id'])!=t['wording'] for t in expected_tasks)):
        valid=False
    return valid, decision, deepcopy(expected_tasks) if valid else []


def completed_courses(goal, records):
    if not goal['sourceKey'].startswith('context:'):
        return []
    context_id=goal['sourceKey'][8:]
    links=records['journey']['courseContexts']
    completed=[]
    for course in records['plan']['courses']:
        if links.get(course['id'])!=context_id or not course['chapters'] or not all(ch['value']==10 for ch in course['chapters']):
            continue
        # Completion is a saved plan report, not proof of skill or external award.
        # A completion date is known only if dated records cover every chapter.
        dates=[]
        for chapter in course['chapters']:
            matches=[day for day,record in records['plan']['records'].items() if any(e['courseId']==course['id'] and e['chapterTitle']==chapter['title'] and e['percent']==100 for e in record.get('entries',[]))]
            if matches:dates.append(max(matches))
        completed.append({'id':course['id'],'title':course['title'],'completed_at':max(dates) if len(dates)==len(course['chapters']) and len({ch['title'] for ch in course['chapters']})==len(course['chapters']) else None,'source_label':'Reported complete in linked course plan'})
    return completed


def current_evidence(records, checked, recorded_at):
    evidence={}
    for goal in records['goals']:
        valid,decision,tasks=resolve_source(goal,records,checked)
        attempts=deepcopy(goal['attempts'])
        completed=completed_courses(goal,records)
        study=[a for a in attempts if a['type']=='study']; course=[a for a in attempts if a['type']=='course_practice']; work=[a for a in attempts if a['type']=='workplace_practice']
        gaps=[]
        if not valid:gaps.append('The original skill or task connection needs review before a new comparison can be saved.')
        if not tasks:gaps.append('No current confirmed task is linked to this goal.')
        if decision not in ('use','accepted'):gaps.append('Current use of this skill has not been reported by you.')
        if not completed:gaps.append('No completed learning with an explicit course link is recorded. Courses are optional.')
        if any(item['completed_at'] is None for item in completed):gaps.append('The completion date for some linked learning was not recorded.')
        if not work:gaps.append('No workplace practice is recorded. This is not evidence that you lack ability.')
        # Initial task context can be valid while a later practice task has changed.
        actual_tasks={t['id']:t['wording'] for t in records['profile'].get('tasks',[])}
        stale_practice=any(a['task'] and actual_tasks.get(a['task']['id'])!=a['task']['wording'] for a in work)
        if stale_practice:gaps.append('Some workplace attempts retain earlier task wording. Review that context before treating them as current work evidence.')
        meaning={'skill':goal['initial']['skill'],'wording':goal['wording'],'tasks':goal['initial']['tasks'],
                 'career':goal['initial']['career'],'origin':goal['initial']['origin'],'sourceOccupationUri':goal['initial']['sourceOccupationUri']}
        evidence[goal['id']]={'recorded_at':recorded_at,'goal_wording':goal['wording'],'skill':deepcopy(goal['initial']['skill']),
            'goal_created_at':goal['createdAt'],'confirmed_tasks':tasks,'task_evidence':tasks if decision in ('use','accepted') else [],
            'decision':decision,'study':study,'course_practice':course,'workplace_practice':work,'completed_learning':completed,'gaps':gaps,
            'source_valid':valid,'stale_practice_context':stale_practice,'meaning_fingerprint':fingerprint(meaning)}
    return evidence


def summary_for(evidence, rows=None):
    all_values=list(evidence.values())
    values=[v for v in all_values if v['source_valid']]
    result={'goals_total':len(all_values),'excluded_goals':len(all_values)-len(values),'with_task_evidence':sum(bool(v['task_evidence']) for v in values),
            'with_current_use':sum(v['decision'] in ('use','accepted') for v in values),
            'with_study':sum(bool(v['study']) for v in values),'with_completed_learning':sum(bool(v['completed_learning']) for v in values),
            'with_course_practice':sum(bool(v['course_practice']) for v in values),'with_workplace_practice':sum(bool(v['workplace_practice']) for v in values),
            'needing_evidence':sum(not v['source_valid'] or (not v['task_evidence'] and not v['study'] and not v['course_practice'] and not v['workplace_practice'] and not v['completed_learning']) for v in all_values),'new_goals':sum(r['status']=='new_goal' for r in (rows or []))}
    return result


def suggested_next_step(item):
    if not item['source_valid']:
        return 'Review this goal’s work and skill connection before using it in a comparison.'
    if item['workplace_practice']:
        return 'Look at your last workplace attempt, then choose whether to repeat or adjust the activity.'
    if item['course_practice']:
        return 'Keep practising with a sample, or consider a real work task if it is appropriate for your role.'
    if item['study'] or item['completed_learning']:
        return 'Open this goal and choose one small practice activity. A sample exercise is enough to start.'
    return 'Open this goal to choose a prepared starting activity, or keep it for later.'


def build_preview(records, checked, workspace_revision, previous=None, recorded_at=None):
    now=recorded_at or stamp(); current=current_evidence(records,checked,now)
    old={r['goal_id']:r['current'] for r in previous.snapshot['goals']} if previous else {}
    rows=[]; resets=[]
    for id,item in current.items():
        earlier=old.get(id)
        if not item['source_valid']:
            status='source_needs_review';reason='The saved skill or task connection changed. Review the source before saving a new starting point.'
        elif earlier is None or not earlier.get('source_valid',True):
            restored=earlier is not None
            earlier=None
            status='new_goal' if previous and not restored else 'starting_point';reason='This goal is newly added and is not an improvement or decline in the earlier set.' if previous and not restored else 'There is no valid earlier progress review for this goal. This saves the current records as your starting point.'
        elif earlier['meaning_fingerprint']!=item['meaning_fingerprint'] or not earlier.get('source_valid',True) or corrected_evidence(earlier,item) or (item['stale_practice_context'] and not earlier.get('stale_practice_context')):
            status='needs_starting_point';reason='The goal meaning, work context or an earlier supporting record changed. Confirm a new starting point instead of comparing against invalid earlier evidence. Earlier reviews remain in history.';resets.append(id)
        else:
            status='comparable';reason='These are records for the same goal at two review dates, not a skill assessment.'
        rows.append({'goal_id':id,'label':item['skill']['label'],'status':status,'reason':reason,'earlier':deepcopy(earlier),'current':item,
                     'next_step':suggested_next_step(item)})
    confirmed=records['profile'].get('tasksConfirmed') is True and bool(records['profile'].get('tasks'))
    can_save=confirmed and any(r['status']!='source_needs_review' for r in rows)
    notice=NOTICE
    if not confirmed:notice='Confirm your work profile before saving a progress review. '+notice
    if any(r['status']=='source_needs_review' for r in rows):notice='Flagged source connections remain visible but are excluded from comparison and evidence counts. You can save a review of the other goals. '+notice
    if not rows:notice='Save a learning goal before creating your first progress starting point. '+notice
    return {'workspace_revision':workspace_revision,'previous_review_id':str(previous.id) if previous else None,'reviewed_at':now,
            'summary':summary_for(current,rows),'goals':rows,'can_save':can_save,'required_reset_goal_ids':resets,'notice':notice}


def substantive_attempt(record):
    return {k:record[k] for k in ('id','date','type','description','notes','task')}


def corrected_evidence(before,after):
    if before['decision'] in ('use','accepted') and after['decision'] not in ('use','accepted'):
        return True
    for kind in ('study','course_practice','workplace_practice'):
        old={a['id']:substantive_attempt(a) for a in before[kind]}
        new={a['id']:substantive_attempt(a) for a in after[kind]}
        if any(new.get(id)!=record for id,record in old.items()):
            return True
    old={c['id']:c for c in before['completed_learning']};new={c['id']:c for c in after['completed_learning']}
    return any(new.get(id)!=record for id,record in old.items())


def review_status(snapshot,current):
    reasons=[]; additions=False
    earlier={r['goal_id']:r['current'] for r in snapshot['goals']}
    if set(current)-set(earlier):additions=True
    for id,before in earlier.items():
        after=current.get(id)
        if not before.get('source_valid',True):
            if after and after['source_valid']:additions=True
            continue
        label=before['skill']['label']
        if after is None or not after['source_valid'] or before['meaning_fingerprint']!=after['meaning_fingerprint']:
            reasons.append(f'{label}: the goal or its source context changed.');continue
        if after['stale_practice_context'] and not before.get('stale_practice_context'):
            reasons.append(f'{label}: a workplace task used in the review changed.')
        if before['decision'] in ('use','accepted') and after['decision'] not in ('use','accepted'):
            reasons.append(f'{label}: the earlier report of current skill use was changed.')
        elif before['decision']!=after['decision']:additions=True
        for kind in ('study','course_practice','workplace_practice'):
            old={a['id']:substantive_attempt(a) for a in before[kind]};new={a['id']:substantive_attempt(a) for a in after[kind]}
            if any(new.get(id)!=record for id,record in old.items()):reasons.append(f'{label}: an earlier {kind.replace("_"," ")} record was corrected or removed.')
            if set(new)-set(old):additions=True
        old={c['id']:c for c in before['completed_learning']};new={c['id']:c for c in after['completed_learning']}
        if any(new.get(id)!=record for id,record in old.items()):reasons.append(f'{label}: a linked completion record changed.')
        if set(new)-set(old):additions=True
    return ('needs_review' if reasons else 'new_evidence_available' if additions else 'current'), list(dict.fromkeys(reasons))


def present_review(review,current,detail=False):
    status,reasons=review_status(review.snapshot,current)
    result={'id':str(review.id),'created_at':review.created_at.isoformat(),'previous_review_id':str(review.previous_review_id) if review.previous_review_id else None,
            'summary':review.snapshot['summary'],'status':status,'status_reasons':reasons}
    if detail:result['snapshot']=deepcopy(review.snapshot)
    return result
