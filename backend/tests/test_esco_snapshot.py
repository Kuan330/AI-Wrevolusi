import pytest
from app.services.esco_snapshot import load_esco_snapshot, validate_esco_snapshot


@pytest.fixture(scope='module')
def snapshot():
    return load_esco_snapshot()


def test_complete_release_keeps_unlinked_and_unspecified_concepts(snapshot):
    assert len(snapshot['occupations']) == 3039
    assert len(snapshot['skills']) == 13939
    assert len(snapshot['relations']) == 129004
    linked = {row['skill_uri'] for row in snapshot['relations']}
    assert sum(row['uri'] not in linked for row in snapshot['skills']) == 447
    assert sum(row['skill_type'] == 'unspecified' for row in snapshot['skills']) == 5
    assert len({row['isco_code'] for row in snapshot['occupations']}) == 426


@pytest.mark.parametrize('field', ['label', 'description'])
def test_source_text_cannot_change_while_reusing_provenance(snapshot, field):
    changed = {**snapshot, 'skills': list(snapshot['skills'])}
    changed['skills'][0] = {**changed['skills'][0], field: 'Changed source text'}
    with pytest.raises(ValueError):
        validate_esco_snapshot(changed)


def test_partial_release_is_not_validated_as_full_coverage(snapshot):
    changed = {**snapshot, 'skills': snapshot['skills'][:-1]}
    with pytest.raises(ValueError, match='Incomplete'):
        validate_esco_snapshot(changed)
