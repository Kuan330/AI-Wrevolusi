"""Keep the test suite deterministic and offline.

The application prefers a configured AI provider and falls back to the OpenCode
free relay, and local development may auto-create database tables. Tests must
neither reach the network nor depend on a developer's local ``.env``.
Environment variables win over ``.env`` values, so pinning them here disables
both network paths for the suite.
"""

import os

os.environ['AI_API_KEY'] = ''
os.environ['AI_KEYLESS'] = 'false'
os.environ['AI_FALLBACK_ENABLED'] = 'false'
os.environ['AUTO_CREATE_TABLES'] = 'false'
os.environ['DATABASE_URL'] = (
    'postgresql+asyncpg://postgres:postgres@localhost:5432/aiwrevolusi'
)
