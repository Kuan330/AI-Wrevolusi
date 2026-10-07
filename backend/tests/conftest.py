"""Keep the test suite deterministic and offline.

The application prefers a configured AI provider and falls back to the OpenCode
free relay, and local development may auto-create database tables. Tests must
neither reach the network nor depend on a developer's local ``.env``.
Environment variables win over ``.env`` values, so pinning them here disables
both network paths for the suite.
"""

import os
import socket

import pytest

# Synthetic credentials and local cookie policy, never developer .env values.
os.environ['JWT_SECRET_KEY'] = 'aiw-offline-test-only-signing-secret-not-for-deployment'
os.environ['JWT_ALGORITHM'] = 'HS256'
os.environ['ACCESS_TOKEN_EXPIRE_MINUTES'] = '30'
os.environ['REFRESH_TOKEN_EXPIRE_DAYS'] = '14'
os.environ['ACCESS_COOKIE_NAME'] = 'aiw_access_token'
os.environ['REFRESH_COOKIE_NAME'] = 'aiw_refresh_token'
os.environ['COOKIE_DOMAIN'] = ''
os.environ['COOKIE_SECURE'] = 'false'
os.environ['COOKIE_SAMESITE'] = 'lax'

os.environ['SKILL_LLM_API_KEY'] = ''
os.environ['AI_API_KEY'] = ''
os.environ['AI_KEYLESS'] = 'false'
os.environ['AI_FALLBACK_ENABLED'] = 'false'
os.environ['AUTO_CREATE_TABLES'] = 'false'
os.environ['DATABASE_URL'] = (
    'postgresql+asyncpg://postgres:postgres@localhost:5432/aiwrevolusi'
)


@pytest.fixture(autouse=True)
def block_network_connections(monkeypatch):
    """Allow in-process HTTP/SQLite doubles, never a real network connection."""
    def denied(*_args, **_kwargs):
        raise AssertionError('Tests must not connect to live databases or network services.')
    if os.name == 'nt':
        # Windows asyncio's self-pipe uses socketpair's TCP fallback. Replace
        # ONLY that internal pair constructor, not normal loopback connections.
        # Bind our own ephemeral listener and connect to that exact socket.
        original_connect = socket.socket.connect

        def internal_socketpair(family=socket.AF_INET, type=socket.SOCK_STREAM, proto=0):
            if family not in (socket.AF_INET, socket.AF_INET6) or type != socket.SOCK_STREAM or proto != 0:
                raise ValueError('Only local stream socket pairs are supported')
            host = '127.0.0.1' if family == socket.AF_INET else '::1'
            with socket.socket(family, type, proto) as listener:
                listener.bind((host, 0))
                listener.listen(1)
                client = socket.socket(family, type, proto)
                try:
                    client.setblocking(False)
                    try:
                        original_connect(client, listener.getsockname())
                    except (BlockingIOError, InterruptedError):
                        pass
                    client.setblocking(True)
                    server, _ = listener.accept()
                    return server, client
                except BaseException:
                    client.close()
                    raise

        monkeypatch.setattr(socket, 'socketpair', internal_socketpair)
    monkeypatch.setattr(socket.socket, 'connect', denied)
    monkeypatch.setattr(socket.socket, 'connect_ex', denied)
