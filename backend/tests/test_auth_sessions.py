"""Synthetic cookie/session regressions using real SQL in an offline SQLite store."""
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.core.security import create_token, decode_token, get_password_hash
from app.db.session import get_db
from app.main import create_app
from app.models.account import Account
from app.models.occupation import Occupation
from app.models.refresh_token import RefreshToken
from app.models.user import User


class OfflineDB:
    def __init__(self, session): self.session = session
    async def execute(self, statement): return self.session.execute(statement)
    async def scalar(self, statement): return self.session.scalar(statement)
    async def commit(self): self.session.commit()
    async def rollback(self): self.session.rollback()
    async def flush(self): self.session.flush()
    async def refresh(self, value): self.session.refresh(value)
    async def get(self, model, key): return self.session.get(model, key)
    def add(self, value): self.session.add(value)


@pytest.fixture
def store():
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    for table in (Occupation.__table__, User.__table__, Account.__table__, RefreshToken.__table__):
        table.create(engine)
    with Session(engine, expire_on_commit=False) as session:
        user = User(id=uuid.uuid4(), email='synthetic@example.com', full_name='Synthetic user', hashed_password=get_password_hash('synthetic-password'), is_active=True)
        session.add(user)
        session.add(Account(user_id=user.id, username='synthetic', workspace={}, revision=0))
        session.commit()
        application = create_app()
        application.dependency_overrides[get_db] = lambda: OfflineDB(session)
        with TestClient(application, raise_server_exceptions=False) as http:
            yield http, session, user
    engine.dispose()


def sign_in(http):
    response = http.post('/api/v1/account/login', json={'username': 'synthetic', 'password': 'synthetic-password'})
    assert response.status_code == 200
    return {name: http.cookies.get(name) for name in (settings.access_cookie_name, settings.refresh_cookie_name)}


def replay(http, cookies, path='/api/v1/account/me', method='GET'):
    http.cookies.clear()
    return http.request(method, path, headers={'Cookie': '; '.join(f'{k}={v}' for k, v in cookies.items() if v)})


def test_login_and_refresh_never_return_token_values(store):
    http, _, _ = store
    response = http.post('/api/v1/auth/login', json={'email': 'synthetic@example.com', 'password': 'synthetic-password'})
    assert response.status_code == 204 and not response.content
    assert response.headers['cache-control'] == 'no-store'
    assert all('HttpOnly' in cookie for cookie in response.headers.get_list('set-cookie'))
    assert http.get('/api/v1/users/me').status_code == 200
    old_refresh = http.cookies.get(settings.refresh_cookie_name)
    response = http.post('/api/v1/auth/refresh')
    assert response.status_code == 204 and not response.content
    assert response.headers['cache-control'] == 'no-store'
    assert http.cookies.get(settings.refresh_cookie_name) != old_refresh


def test_copied_access_and_refresh_are_rejected_after_logout(store):
    http, _, _ = store
    copied = sign_in(http)
    assert http.post('/api/v1/auth/logout').status_code == 204
    assert replay(http, copied).status_code == 401
    assert replay(http, copied, '/api/v1/auth/refresh', 'POST').status_code == 401


def test_logout_with_access_cookie_only_revokes_session(store):
    http, _, _ = store
    copied = sign_in(http)
    access = {settings.access_cookie_name: copied[settings.access_cookie_name]}
    assert replay(http, access, '/api/v1/auth/logout', 'POST').status_code == 204
    assert replay(http, copied).status_code == 401
    assert replay(http, copied, '/api/v1/auth/refresh', 'POST').status_code == 401


def test_refresh_rotates_one_record_and_old_refresh_cannot_be_reused(store):
    http, db, _ = store
    old = sign_in(http)
    old_payload = decode_token(old[settings.refresh_cookie_name])
    assert http.post('/api/v1/auth/refresh').status_code == 204
    new_payload = decode_token(http.cookies.get(settings.refresh_cookie_name))
    assert new_payload['sid'] == old_payload['sid']
    assert new_payload['jti'] != old_payload['jti']
    assert db.scalar(select(func.count()).select_from(RefreshToken)) == 1
    assert replay(http, old, '/api/v1/auth/refresh', 'POST').status_code == 401
    assert replay(http, {settings.access_cookie_name: old[settings.access_cookie_name]}).status_code == 200


@pytest.mark.parametrize('refresh_first', [True, False])
def test_refresh_and_logout_cannot_restore_revoked_access(store, refresh_first):
    http, _, _ = store
    old = sign_in(http)
    new = old
    if refresh_first:
        assert http.post('/api/v1/auth/refresh').status_code == 204
        new = {name: http.cookies.get(name) for name in old}
    assert replay(http, old, '/api/v1/auth/logout', 'POST').status_code == 204
    if not refresh_first:
        assert replay(http, old, '/api/v1/auth/refresh', 'POST').status_code == 401
    assert replay(http, old).status_code == 401
    assert replay(http, new).status_code == 401
    assert replay(http, new, '/api/v1/auth/refresh', 'POST').status_code == 401


def test_logging_out_one_sign_in_keeps_another_sign_in(store):
    http, _, _ = store
    first = sign_in(http)
    second = sign_in(http)
    assert replay(http, first, '/api/v1/auth/logout', 'POST').status_code == 204
    assert replay(http, first).status_code == 401
    assert replay(http, second).status_code == 200


def test_expired_signed_access_cookie_can_revoke_the_session(store):
    http, _, user = store
    copied = sign_in(http)
    sid = decode_token(copied[settings.access_cookie_name])['sid']
    expired = create_token(str(user.id), 'access', timedelta(seconds=-1), {'sid': sid})
    assert replay(http, {settings.access_cookie_name: expired}).status_code == 401
    assert replay(http, {settings.access_cookie_name: expired}, '/api/v1/auth/logout', 'POST').status_code == 204
    assert replay(http, copied).status_code == 401
    assert replay(http, copied, '/api/v1/auth/refresh', 'POST').status_code == 401


@pytest.mark.parametrize('change', ['missing', 'revoked', 'expired', 'inactive'])
def test_unusable_stored_sessions_reject_access_and_refresh(store, change):
    http, db, user = store
    copied = sign_in(http)
    session = db.scalars(select(RefreshToken)).one()
    if change == 'missing': db.delete(session)
    elif change == 'revoked': session.revoked_at = datetime.now(UTC)
    elif change == 'expired': session.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    else: user.is_active = False
    db.commit()
    assert replay(http, copied).status_code == 401
    assert replay(http, copied, '/api/v1/auth/refresh', 'POST').status_code == 401


@pytest.mark.parametrize('claim', [
    {'sub': 'not-a-uuid'}, {'sid': 'not-a-uuid'}, {'sid': None}, {'sid': str(uuid.uuid4())}, {'sub': str(uuid.uuid4())},
])
def test_invalid_identity_and_wrong_owner_fail_closed(store, claim):
    http, _, _ = store
    copied = sign_in(http)
    payload = decode_token(copied[settings.refresh_cookie_name])
    payload.update(claim)
    access = create_token(payload['sub'], 'access', timedelta(minutes=5), {'sid': payload['sid']})
    refresh = create_token(payload['sub'], 'refresh', timedelta(minutes=5), {'sid': payload['sid'], 'jti': payload['jti']})
    assert replay(http, {settings.access_cookie_name: access}).status_code == 401
    assert replay(http, {settings.refresh_cookie_name: refresh}, '/api/v1/auth/refresh', 'POST').status_code == 401


def test_legacy_tokens_require_a_fresh_sign_in(store):
    http, _, user = store
    copied = sign_in(http)
    jti = decode_token(copied[settings.refresh_cookie_name])['jti']
    access = create_token(str(user.id), 'access', timedelta(minutes=5))
    refresh = create_token(str(user.id), 'refresh', timedelta(minutes=5), {'jti': jti})
    assert replay(http, {settings.access_cookie_name: access}).status_code == 401
    assert replay(http, {settings.refresh_cookie_name: refresh}, '/api/v1/auth/refresh', 'POST').status_code == 401
    assert sign_in(http)
    assert http.get('/api/v1/account/me').status_code == 200


def test_tampered_logout_cookie_cannot_revoke_the_real_session(store):
    http, _, _ = store
    copied = sign_in(http)
    prefix, signature = copied[settings.access_cookie_name].rsplit('.', 1)
    invalid = prefix + '.' + ('A' if signature[0] != 'A' else 'B') + signature[1:]
    assert replay(http, {settings.access_cookie_name: invalid}, '/api/v1/auth/logout', 'POST').status_code == 204
    assert replay(http, copied).status_code == 200


def test_mismatched_user_and_session_cannot_revoke_either_user(store):
    http, _, _ = store
    first = sign_in(http)
    response = http.post('/api/v1/account/register', json={'username': 'other_user', 'password': 'synthetic-password'})
    assert response.status_code == 201
    second = {name: http.cookies.get(name) for name in first}
    first_sid = decode_token(first[settings.access_cookie_name])['sid']
    invalid = create_token(response.json()['id'], 'access', timedelta(minutes=5), {'sid': first_sid})
    assert replay(http, {settings.access_cookie_name: invalid}, '/api/v1/auth/logout', 'POST').status_code == 204
    assert replay(http, first).status_code == 200
    assert replay(http, second).status_code == 200


def test_mixed_cookies_revoke_both_presented_sign_ins(store):
    http, _, _ = store
    first = sign_in(http)
    second = sign_in(http)
    mixed = {settings.access_cookie_name: first[settings.access_cookie_name], settings.refresh_cookie_name: second[settings.refresh_cookie_name]}
    assert replay(http, mixed, '/api/v1/auth/logout', 'POST').status_code == 204
    assert replay(http, first).status_code == 401
    assert replay(http, second).status_code == 401
