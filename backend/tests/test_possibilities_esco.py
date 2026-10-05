import json

from app.services.possibilities import MODERN_PROFILE_KEY, rank_esco_directions, reviewed_esco_evidence
from app.services.specialist_review import SPECIALIST_KEY

CURRENT_SKILL = 'http://data.europa.eu/esco/skill/12345678-1234-1234-1234-123456789abc'
OTHER_SKILL = 'http://data.europa.eu/esco/skill/22345678-1234-1234-1234-123456789abc'
OCCUPATION = 'http://data.europa.eu/esco/occupation/12345678-1234-1234-1234-123456789abc'


def workspace_with_review(*, task_wording='Interpret mechanical drawings', decision='use', wants_learning=True, source_version='1.2.0'):
    entry = {
        'taskId': 'task-1', 'taskWording': task_wording, 'occupationCode': '3115',
        'skillUri': CURRENT_SKILL, 'skillLabel': 'Interpret drawings', 'sourceVersion': source_version,
        'decision': decision, 'wantsLearning': wants_learning, 'updatedAt': '2026-09-29T00:00:00.000Z',
    }
    profile = {'analysis': {'occupationCode': '3115', 'tasks': [
        {'id': 'task-1', 'wording': 'Interpret mechanical drawings'},
    ]}}
    review = {'version': 1, 'entries': [entry], 'focusKey': None}
    return {MODERN_PROFILE_KEY: json.dumps(profile), SPECIALIST_KEY: json.dumps(review)}


def test_reviewed_evidence_requires_current_task_wording_and_pinned_version():
    current, developing = reviewed_esco_evidence(workspace_with_review())
    assert current == {CURRENT_SKILL}
    assert developing == set()

    stale_task, stale_learning = reviewed_esco_evidence(workspace_with_review(task_wording='Different wording'))
    assert stale_task == set()
    assert stale_learning == set()

    other_version, _ = reviewed_esco_evidence(workspace_with_review(source_version='1.1.0'))
    assert other_version == set()


def test_learning_interest_is_not_current_use():
    current, developing = reviewed_esco_evidence(workspace_with_review(decision='no', wants_learning=True))
    assert current == set()
    assert developing == {CURRENT_SKILL}


def test_ranking_uses_exact_links_and_only_roles_with_current_overlap():
    roles = [
        {'uri': OCCUPATION, 'isco_code': '3115', 'label': 'Mechanical technician', 'description': 'Role'},
        {'uri': OCCUPATION + '-other', 'isco_code': '9999', 'label': 'Unrelated role', 'description': 'Role'},
    ]
    relations = [
        {'occupation_uri': OCCUPATION, 'skill_uri': CURRENT_SKILL, 'relation': 'essential'},
        {'occupation_uri': OCCUPATION, 'skill_uri': OTHER_SKILL, 'relation': 'essential'},
        {'occupation_uri': OCCUPATION + '-other', 'skill_uri': OTHER_SKILL, 'relation': 'essential'},
    ]
    concepts = {CURRENT_SKILL: {'label': 'Interpret drawings'}, OTHER_SKILL: {'label': 'Use specialist tools'}}
    source = {'name': 'ESCO', 'version': '1.2.0', 'retrieved_at': '2026-09-29T00:00:00Z',
              'source_url': 'https://ec.europa.eu/esco/portal', 'attribution': 'European Commission, ESCO.'}
    ranked = rank_esco_directions(roles, relations, concepts, {CURRENT_SKILL}, set(), source)

    assert [role['occupation_uri'] for role in ranked] == [OCCUPATION]
    assert ranked[0]['current_skill_overlap'] == 1
    assert ranked[0]['essential_not_yet_evidenced'] == 1
    assert [skill['state'] for skill in ranked[0]['requirements']] == ['current', 'not_yet_evidenced']


def test_ranking_returns_no_roles_without_current_or_learning_skill():
    ranked = rank_esco_directions(
        [{'uri': OCCUPATION, 'isco_code': '3115', 'label': 'Mechanical technician', 'description': 'Role'}],
        [{'occupation_uri': OCCUPATION, 'skill_uri': CURRENT_SKILL, 'relation': 'essential'}],
        {CURRENT_SKILL: {'label': 'Interpret drawings'}}, set(), set(), None,
    )
    assert ranked == []


def test_ranking_includes_roles_matched_only_by_learning_interest():
    ranked = rank_esco_directions(
        [{'uri': OCCUPATION, 'isco_code': '3115', 'label': 'Mechanical technician', 'description': 'Role'}],
        [{'occupation_uri': OCCUPATION, 'skill_uri': CURRENT_SKILL, 'relation': 'essential'}],
        {CURRENT_SKILL: {'label': 'Interpret drawings'}}, set(), {CURRENT_SKILL}, None,
    )
    assert [role['occupation_uri'] for role in ranked] == [OCCUPATION]
    assert ranked[0]['current_skill_overlap'] == 0
    assert ranked[0]['developing_skill_overlap'] == 1
    assert [skill['state'] for skill in ranked[0]['requirements']] == ['developing']

