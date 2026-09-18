import uuid
import pytest
from pydantic import ValidationError
from app.routers.accounts import Credentials, WorkspaceUpdate


def test_username_case_and_password_rules():
    assert Credentials(username='My_User', password='secure-password').username == 'my_user'
    for username, password in [('ab', 'secure-password'), ('a b', 'secure-password'), ('valid', 'short')]:
        with pytest.raises(ValidationError):
            Credentials(username=username, password=password)


def test_workspace_rejects_unknown_keys_and_invalid_json():
    with pytest.raises(ValidationError):
        WorkspaceUpdate(owner_id=uuid.uuid4(), data={'password': '"secret"'}, revision=0)
    with pytest.raises(ValidationError):
        WorkspaceUpdate(owner_id=uuid.uuid4(), data={'aiwrevolusi.userProfile': 'not JSON'}, revision=0)
    with pytest.raises(ValidationError):
        WorkspaceUpdate(owner_id=uuid.uuid4(), data={}, revision=-1)


@pytest.mark.parametrize('value', ['null', '{}', '[true]', '["2"]', '[1.0]', '[0]', '[-1]', str(list(range(1, 62)))])
def test_workspace_rejects_invalid_shortlist_shape(value):
    with pytest.raises(ValidationError):
        WorkspaceUpdate(owner_id=uuid.uuid4(), data={'aiwrevolusi.possibilities.shortlist': value}, revision=0)


def test_workspace_shortlist_write_does_not_require_live_reference_ids():
    value = '[10000, 10000, 2]'
    payload = WorkspaceUpdate(owner_id=uuid.uuid4(), data={'aiwrevolusi.possibilities.shortlist': value}, revision=0)
    assert payload.data['aiwrevolusi.possibilities.shortlist'] == value


@pytest.mark.parametrize('value, expected', [(None, []), ({}, []), (['bad', 2, True, 999, 2], [2])])
def test_legacy_shortlist_reads_drop_invalid_or_retired_ids(value, expected):
    from app.services.workspace import read_workspace_shortlist
    assert read_workspace_shortlist(value, allowed_skill_ids={1, 2}) == expected


def test_possibilities_route_survives_invalid_legacy_shortlist(monkeypatch):
    import asyncio
    from types import SimpleNamespace
    from unittest.mock import AsyncMock, Mock
    import app.routers.possibilities as route

    monkeypatch.setattr(route, '_load_reference_data', AsyncMock(return_value=(
        {2: {'core_skill': 'Creative thinking'}}, [],
    )))
    task_rows = Mock()
    task_rows.mappings.return_value.all.return_value = []
    account_row = Mock()
    account_row.scalar_one_or_none.return_value = {
        'aiwrevolusi.possibilities.shortlist': '["bad", true, 999, 2]',
    }
    db = SimpleNamespace(execute=AsyncMock(side_effect=[account_row, task_rows]))
    user = SimpleNamespace(id=uuid.uuid4(), occupation_id=None)
    response = asyncio.run(route.get_possibilities(current_user=user, db=db))
    assert response.shortlisted_skill_ids == [2]
    assert response.skills[0].state == 'shortlisted'
