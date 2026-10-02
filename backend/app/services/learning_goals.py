"""Personal learning evidence. Changes preserve the original source and prior records."""
from datetime import date, datetime, timedelta, timezone
import json
import re

LEARNING_GOALS_KEY = 'aiwrevolusi.learningGoals.v1'
ERROR = 'Saved learning goals are invalid. Reload your saved account before changing them.'
MAX_GOAL_REVISIONS = 1000
MAX_ATTEMPT_VERSIONS = 5000


def text(v, maximum, empty=False):
    return isinstance(v, str) and len(v) <= maximum and (empty or bool(v.strip()))


def fields(v, names):
    return isinstance(v, dict) and set(v) == set(names.split())


def dated(v):
    try:
        return text(v, 40) and datetime.fromisoformat(v.replace('Z', '+00:00')) is not None
    except ValueError:
        return False


def task(v):
    return fields(v, 'id wording') and text(v['id'], 200) and text(v['wording'], 5000)


def action(v):
    return v is None or (isinstance(v, dict) and {'kind', 'text'} <= set(v) <= {'kind', 'text', 'origin'}
                         and v.get('origin', 'template') in ('ai_suggestion', 'template')
                         and v['kind'] in ('understand', 'practise', 'find_learning') and text(v['text'], 1000))


def attempt(v):
    if not fields(v, 'id date type description notes task createdAt updatedAt'):
        return False
    try:
        valid_date = text(v['date'], 10) and date.fromisoformat(v['date']).isoformat() == v['date']
    except ValueError:
        valid_date = False
    return (text(v['id'], 100) and valid_date and v['type'] in ('study', 'course_practice', 'workplace_practice')
            and text(v['description'], 2000) and text(v['notes'], 4000, True)
            and (task(v['task']) if v['type'] == 'workplace_practice' else v['task'] is None)
            and dated(v['createdAt']) and dated(v['updatedAt']))


def attempts(v):
    return isinstance(v, list) and len(v) <= 200 and all(attempt(a) for a in v) and len({a['id'] for a in v}) == len(v)


def snapshot(v):
    if not fields(v, 'skill decision tasks occupationCode sourceOccupationUri career origin workKey wording'):
        return False
    s = v['skill']
    if not fields(s, 'source id label sourceVersion') or not text(s['id'], 200):
        return False
    skill_ok = ((s['source'] == 'esco' and re.fullmatch(r'http://data\.europa\.eu/esco/skill/[0-9a-f-]{36}', s['id']) and text(s['sourceVersion'], 40))
                or (s['source'] == 'wef' and re.fullmatch(r'[1-9]\d*', s['id']) and s['sourceVersion'] is None)
                or (s['source'] == 'personal' and text(s['id'], 100) and s['sourceVersion'] is None))
    return (skill_ok and text(s['label'], 300) and v['decision'] in (None, 'use', 'no', 'unsure', 'accepted', 'rejected')
            and isinstance(v['tasks'], list) and len(v['tasks']) <= 100 and all(task(t) for t in v['tasks'])
            and (v['occupationCode'] is None or text(v['occupationCode'], 40))
            and (v['sourceOccupationUri'] is None or (text(v['sourceOccupationUri'], 200) and re.fullmatch(r'http://data\.europa\.eu/esco/occupation/[0-9a-f-]{36}', v['sourceOccupationUri'])))
            and (v['career'] is None or (fields(v['career'], 'code title') and text(v['career']['code'], 40) and text(v['career']['title'], 200)))
            and v['origin'] in ('work', 'career', 'browse') and (v['origin'] != 'career' or v['career'] is not None)
            and (v['workKey'] is None or text(v['workKey'], 100000, True)) and text(v['wording'], 1000))


def expand_learning_goal_storage(value):
    """Read compact attempt references without changing the supplied stored document."""
    if not fields(value, 'version goals') or type(value['version']) is not int or value['version'] not in (1, 2) or not isinstance(value['goals'], list) or len(value['goals']) > 100:
        raise ValueError(ERROR)
    if value['version'] == 1:
        return value
    expanded = []
    for raw in value['goals']:
        if isinstance(raw, dict) and type(raw.get('revision')) is int and raw['revision'] > MAX_GOAL_REVISIONS:
            raise ValueError('This goal has reached its history limit of 1000 versions. Your records are kept. Additional storage is needed before more changes can be saved.')
        if (not fields(raw, 'id sourceKey createdAt initial wording action attemptPool attemptRefs history revision needsReview updatedAt')
                or not isinstance(raw['attemptPool'], list) or len(raw['attemptPool']) > MAX_ATTEMPT_VERSIONS
                or not all(attempt(a) for a in raw['attemptPool']) or not isinstance(raw['history'], list)
                or len(raw['history']) >= MAX_GOAL_REVISIONS):
            raise ValueError(ERROR)
        pool = raw['attemptPool']
        if len({json.dumps(a, sort_keys=True, separators=(',', ':')) for a in pool}) != len(pool):
            raise ValueError(ERROR)
        used = set()

        def resolve(refs):
            if not isinstance(refs, list) or len(refs) > 200 or any(type(i) is not int or not 0 <= i < len(pool) for i in refs):
                raise ValueError(ERROR)
            used.update(refs)
            return [pool[i] for i in refs]

        current = resolve(raw['attemptRefs'])
        history = []
        for record in raw['history']:
            if not fields(record, 'revision recordedAt wording action attemptRefs'):
                raise ValueError(ERROR)
            history.append({key: item for key, item in record.items() if key != 'attemptRefs'} | {'attempts': resolve(record['attemptRefs'])})
        if len(used) != len(pool):
            raise ValueError(ERROR)
        goal = {key: item for key, item in raw.items() if key not in ('attemptPool', 'attemptRefs', 'history')}
        expanded.append(goal | {'attempts': current, 'history': history})
    return {'version': 1, 'goals': expanded}


def validate_learning_goals(value):
    value = expand_learning_goal_storage(value)
    if not fields(value, 'version goals') or type(value['version']) is not int or value['version'] != 1 or not isinstance(value['goals'], list) or len(value['goals']) > 100:
        raise ValueError(ERROR)
    ids = set()
    for g in value['goals']:
        if isinstance(g, dict) and type(g.get('revision')) is int and g['revision'] > MAX_GOAL_REVISIONS:
            raise ValueError('This goal has reached its history limit of 1000 versions. Your records are kept. Additional storage is needed before more changes can be saved.')
        if (not fields(g, 'id sourceKey createdAt initial wording action attempts history revision needsReview updatedAt')
                or not text(g['id'], 100) or not text(g['sourceKey'], 500) or not dated(g['createdAt']) or not dated(g['updatedAt'])
                or not snapshot(g['initial']) or not text(g['wording'], 1000) or not action(g['action']) or not attempts(g['attempts'])
                or type(g['revision']) is not int or not 1 <= g['revision'] <= MAX_GOAL_REVISIONS or type(g['needsReview']) is not bool
                or not isinstance(g['history'], list) or len(g['history']) != g['revision'] - 1 or g['id'] in ids):
            raise ValueError(ERROR)
        ids.add(g['id'])
        for i, h in enumerate(g['history']):
            if (not fields(h, 'revision recordedAt wording action attempts') or type(h['revision']) is not int or h['revision'] != i + 1
                    or not dated(h['recordedAt']) or not text(h['wording'], 1000) or not action(h['action']) or not attempts(h['attempts'])):
                raise ValueError(ERROR)
    return value


def validate_learning_goal_transition(previous_data, next_data):
    """Enforce immutable baselines and append-only history under the account row lock."""
    previous = validate_learning_goals(json.loads(previous_data.get(LEARNING_GOALS_KEY, '{"version":1,"goals":[]}')))
    current = validate_learning_goals(json.loads(next_data.get(LEARNING_GOALS_KEY, '{"version":1,"goals":[]}')))
    old = {g['id']: g for g in previous['goals']}
    new = {g['id']: g for g in current['goals']}
    if not old.keys() <= new.keys():
        raise ValueError('Keep existing goals and their history. Remove an attempt through its goal instead.')
    for goal_id, g in new.items():
        before = old.get(goal_id)
        if before is None:
            if g['revision'] != 1 or g['history'] or g['attempts'] or g['needsReview'] or g['action'] is not None or g['wording'] != g['initial']['wording']:
                raise ValueError(ERROR)
            try:
                validate_new_goal_source(g, next_data)
            except (KeyError, TypeError, AttributeError) as error:
                raise ValueError("The saved source could not be read. Review your work and learning choice.") from error
            continue
        if g == before:
            continue
        if any(g[k] != before[k] for k in ('id', 'sourceKey', 'createdAt', 'initial')):
            raise ValueError('A goal starting record cannot be changed. Start a new goal for a different context.')
        if g['revision'] != before['revision'] + 1 or not g['needsReview'] or g['history'][:-1] != before['history']:
            raise ValueError('Keep the dated goal history when correcting a record.')
        last = g['history'][-1]
        if any(last[k] != before[k] for k in ('revision', 'wording', 'action', 'attempts')):
            raise ValueError('The previous goal record must remain in its history.')
        old_attempts = {a['id']: a for a in before['attempts']}
        removed_ids = {a['id'] for h in before['history'] for a in h['attempts']} - old_attempts.keys()
        for a in g['attempts']:
            previous_attempt = old_attempts.get(a['id'])
            if previous_attempt != a:
                # Accept any user's local today, including UTC+14.
                if date.fromisoformat(a['date']) > (datetime.now(timezone.utc) + timedelta(hours=14)).date():
                    raise ValueError('An attempt date cannot be in the future.')
                if a['type'] == 'workplace_practice' and (not previous_attempt or previous_attempt['task'] != a['task']):
                    validate_current_task(a['task'], next_data)
            if a['id'] in removed_ids or (a['id'] in old_attempts and a['createdAt'] != old_attempts[a['id']]['createdAt']):
                raise ValueError('Keep the original attempt date and use a new ID for a new attempt.')


def validate_new_goal_source(goal, data):
    """Match carried evidence to saved records, without treating discovery as a career."""
    initial = goal['initial']
    source_key = goal['sourceKey']
    if source_key.startswith('specialist:'):
        entries = json.loads(data.get('aiwrevolusi.specialistSkills.v1', '{"entries":[]}')).get('entries', [])
        entry = next((e for e in entries if 'specialist:' + json.dumps([e['taskId'], e['skillUri']], separators=(',', ':'), ensure_ascii=False) == source_key), None)
        if not entry or not entry['wantsLearning']:
            raise ValueError('Choose a saved learning interest before creating a goal.')
        expected = {'skill': {'source':'esco','id':entry['skillUri'],'label':entry['skillLabel'],'sourceVersion':entry['sourceVersion']},
                    'decision':entry['decision'],'tasks':[{'id':entry['taskId'],'wording':entry['taskWording']}],
                    'occupationCode':entry['occupationCode'],'sourceOccupationUri':entry.get('sourceOccupationUri'),
                    'career':None,'origin':'work','workKey':None,'wording':'Develop ' + entry['skillLabel']}
        if initial != expected:
            raise ValueError('The goal must keep the saved skill and work context.')
        profile = json.loads(data.get('aiwrevolusi.userProfile', '{}'))
        if profile.get('tasksOccupationCode') != entry['occupationCode']:
            raise ValueError('Review the skill against your current work first.')
        validate_current_task(expected['tasks'][0], data)
    elif source_key.startswith('personal:'):
        journey = json.loads(data.get('aiwrevolusi.journey.v1', '{}'))
        entry = next((e for e in journey.get('personalSkills', []) if 'personal:' + e['id'] == source_key), None)
        if not entry or not entry.get('wantsLearning', False):
            raise ValueError('Choose a saved learning interest for this personal skill first.')
        expected = {'skill': {'source':'personal','id':entry['id'],'label':entry['name'],'sourceVersion':None},
                    'decision':entry.get('decision'), 'tasks':[{'id':i,'wording':w} for i,w in zip(entry['taskIds'],entry['taskLabels'])],
                    'occupationCode':None,'sourceOccupationUri':None,'career':None,'origin':'work',
                    'workKey':entry['workKey'],'wording':'Develop ' + entry['name']}
        if initial != expected:
            raise ValueError('The goal must keep your saved personal skill and its work context.')
        for item in expected['tasks']:
            validate_current_task(item, data)
    elif source_key.startswith('onboarding:'):
        from app.services.learning_onboarding import validate_onboarding_source
        validate_onboarding_source(goal, data)
    elif source_key.startswith('context:'):
        context = json.loads(data.get('aiwrevolusi.journey.v1', '{"contexts":{}}')).get('contexts', {}).get(source_key[8:])
        if not context:
            raise ValueError('Choose a saved learning context first.')
        expected = {'skill':{'source':'wef','id':str(context['skill']['id']),'label':context['skill']['name'],'sourceVersion':None},
                    'decision':'accepted' if context['origin']=='work' else None,
                    'tasks':[{'id':i,'wording':w} for i,w in zip(context['taskIds'],context['taskLabels'])],
                    'occupationCode':None,'sourceOccupationUri':None,'career':context.get('career') if context['origin']=='career' else None,
                    'origin':context['origin'],'workKey':context['workKey'],'wording':context['goal'].strip() or 'Develop ' + context['skill']['name']}
        if initial != expected:
            raise ValueError('The goal must keep the saved learning context.')
        if context['origin']=='work':
            journey = json.loads(data['aiwrevolusi.journey.v1'])
            if not expected['tasks'] or journey.get('review', {}).get('decisions', {}).get(str(context['skill']['id'])) != 'accepted':
                raise ValueError('Review this skill choice against your current work first.')
            for t in expected['tasks']:
                validate_current_task(t, data)
        elif context['origin']=='career':
            profile = json.loads(data.get('aiwrevolusi.userProfile', '{}'))
            recorded_work = json.loads(context['workKey'])
            occupation = profile.get('tasksOccupationCode')
            if occupation is None:
                occupation = (profile.get('analysis') or {}).get('occupationCode')
            current_tasks = {t['id']: t['wording'] for t in profile.get('tasks', [])}
            recorded_tasks = {t['id']: t['wording'] for t in recorded_work.get('tasks', [])}
            if recorded_work.get('occupationCode') != occupation or current_tasks != recorded_tasks:
                raise ValueError('Review this career choice against your current work first.')
    else:
        raise ValueError('A saved learning choice is required.')


def validate_current_task(task_value, data):
    profile = json.loads(data.get('aiwrevolusi.userProfile', '{}'))
    if not isinstance(profile, dict) or not isinstance(profile.get('tasks', []), list):
        raise ValueError('Your work profile could not be read.')
    if not profile.get('tasksConfirmed') or not any(isinstance(t, dict) and t.get('id') == task_value['id'] and t.get('wording') == task_value['wording'] for t in profile.get('tasks', [])):
        raise ValueError('Choose a confirmed real work task for workplace practice.')
