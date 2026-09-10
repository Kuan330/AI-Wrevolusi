"""Keep the test suite deterministic and offline.

The application prefers a configured AI provider and falls back to the OpenCode
free relay; tests must neither reach the network nor depend on a developer's
local ``.env``.  Environment variables win over ``.env`` values, so pinning
them here disables the whole provider chain for the suite.
"""

import os

os.environ['AI_API_KEY'] = ''
os.environ['AI_KEYLESS'] = 'false'
os.environ['AI_FALLBACK_ENABLED'] = 'false'
