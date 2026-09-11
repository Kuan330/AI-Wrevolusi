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
