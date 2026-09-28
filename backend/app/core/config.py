from functools import lru_cache
from pathlib import Path
from typing import Annotated
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[2]
REPO_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(REPO_DIR / '.env', BACKEND_DIR / '.env'),
        env_file_encoding='utf-8',
        case_sensitive=False,
        extra='ignore',
    )

    app_name: str = 'AI-Wrevolusi API'
    api_version: str = 'v1'
    debug: bool = False
    sql_echo: bool = False
    auto_create_tables: bool = False

    database_url: str = Field(
        default='postgresql+asyncpg://postgres:postgres@localhost:5432/aiwrevolusi'
    )
    # Asyncpg connection pool — sized for Neon / shared Postgres under concurrent
    # search, register, and Possibilities traffic without exhausting free tiers.
    db_pool_size: int = Field(default=10, ge=1, le=40)
    db_max_overflow: int = Field(default=20, ge=0, le=80)
    db_pool_timeout: float = Field(default=30, gt=0, le=120)
    db_pool_recycle: int = Field(default=1800, ge=60, le=7200)

    # Soft ceiling for the optional occupation-search keyword normaliser so a
    # slow LLM never blocks the whole search past the client timeout.
    # 5s covers Vercel → LLM latency; still well under typical client timeouts.
    occupation_search_normaliser_timeout_s: float = Field(default=5.0, gt=0, le=10)

    jwt_secret_key: str = Field(default='change-me-in-production')
    jwt_algorithm: str = 'HS256'
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 14

    access_cookie_name: str = 'aiw_access_token'
    refresh_cookie_name: str = 'aiw_refresh_token'
    cookie_domain: str | None = None
    cookie_secure: bool = False
    cookie_samesite: str = 'lax'

    cors_origins: Annotated[list[str], NoDecode] = [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
    ]

    skill_llm_base_url: str = 'https://openrouter.ai/api/v1'
    skill_llm_api_key: str | None = None
    skill_llm_model: str = 'openai/gpt-5-mini'
    skill_llm_app_name: str = 'AI-Wrevolusi'
    skill_llm_app_url: str | None = None
    skill_request_timeout_s: float = Field(default=60, gt=0, le=180)
    skill_max_retries: int = Field(default=2, ge=0, le=5)
    skill_prompt_version: str = 'skill-directions-v1'

    # Optional OpenAI-compatible provider for the candidate-constrained AI
    # endpoints. The provider is skipped when ai_api_key is empty and
    # ai_keyless is false; ai_api_mode selects the wire protocol and
    # ai_extra_headers adds optional JSON-configured request headers (for
    # example an anonymous relay's session-affinity header).
    ai_api_key: str | None = None
    ai_base_url: str = 'https://api.openai.com/v1'
    ai_model: str = 'gpt-4o-mini'
    ai_api_mode: str = 'chat_completions'
    ai_keyless: bool = False
    ai_extra_headers: str = ''
    # Built-in safety net for the provider chain: when no key is configured
    # (or the configured provider is unavailable at runtime) the AI layers
    # fall back to the OpenCode Zen free relay. Set to false to disable it.
    ai_fallback_enabled: bool = True
    ai_fallback_base_url: str = 'https://opencode.ai/zen/v1'
    ai_fallback_model: str = 'muse-spark-1.3-contributor-free'
    ai_timeout_seconds: float = Field(default=20, gt=0, le=180)
    ai_max_retries: int = Field(default=2, ge=0, le=5)
    ai_rpm_limit: int = Field(default=60, gt=0, le=6000)
    ai_cache_size: int = Field(default=128, ge=0, le=4096)

    @field_validator('cors_origins', mode='before')
    @classmethod
    def parse_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [item.strip() for item in value.split(',') if item.strip()]
        return value

    @field_validator('database_url', mode='before')
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        """Accept Neon URLs copied from the console and adapt them for asyncpg."""
        if value.startswith('postgresql://'):
            value = value.replace('postgresql://', 'postgresql+asyncpg://', 1)
        parts = urlsplit(value)
        query: list[tuple[str, str]] = []
        for key, item in parse_qsl(parts.query, keep_blank_values=True):
            if key == 'channel_binding':
                continue
            query.append(('ssl' if key == 'sslmode' else key, item))
        return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
