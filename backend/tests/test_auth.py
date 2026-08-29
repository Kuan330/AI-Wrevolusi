from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_password_hash,
    verify_password,
)


def test_password_hash_roundtrip() -> None:
    hashed = get_password_hash('secure-password')
    assert verify_password('secure-password', hashed)
    assert not verify_password('wrong-password', hashed)


def test_jwt_generation_and_decode() -> None:
    access_token = create_access_token('123')
    payload = decode_token(access_token)
    assert payload is not None
    assert payload['sub'] == '123'
    assert payload['type'] == 'access'

    refresh_token = create_refresh_token('123', 'token-jti')
    refresh_payload = decode_token(refresh_token)
    assert refresh_payload is not None
    assert refresh_payload['type'] == 'refresh'
    assert refresh_payload['jti'] == 'token-jti'
