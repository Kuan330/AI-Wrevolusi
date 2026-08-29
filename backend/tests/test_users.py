from app.schemas.user import UserCreate


def test_user_create_schema() -> None:
    payload = UserCreate(
        email='christine@example.com',
        full_name='Christine Lim',
        password='example-pass-123',
    )
    assert payload.email == 'christine@example.com'
    assert payload.full_name == 'Christine Lim'
