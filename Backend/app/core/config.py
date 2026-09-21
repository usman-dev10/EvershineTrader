from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Evershine API"
    app_env: str = "local"
    api_prefix: str = "/api/v1"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    # Required: Supabase / Postgres (asyncpg)
    database_url: str = Field(
        default="",
        description="postgresql+asyncpg://... connection string",
    )

    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = Field(
        default="super-secret-jwt-token-with-at-least-32-characters-long",
        min_length=32,
    )

    # Keep false for deploy. Local/dev may set DEMO_AUTH_ENABLED=true.
    demo_auth_enabled: bool = False
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 720

    @field_validator("database_url")
    @classmethod
    def _require_postgres(cls, value: str) -> str:
        url = (value or "").strip()
        if not url:
            raise ValueError("DATABASE_URL is required (postgresql+asyncpg://...).")
        if url.startswith("sqlite"):
            raise ValueError("SQLite is not supported. Use Supabase Postgres.")
        return url

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_sqlite(self) -> bool:
        return False

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() in {"production", "prod"}


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    if settings.is_production:
        weak = "super-secret-jwt-token-with-at-least-32-characters-long"
        if settings.supabase_jwt_secret == weak:
            raise RuntimeError(
                "Set a strong SUPABASE_JWT_SECRET before deploying to production."
            )
        if settings.demo_auth_enabled:
            raise RuntimeError(
                "DEMO_AUTH_ENABLED must be false in production."
            )
    return settings
