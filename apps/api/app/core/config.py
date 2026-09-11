from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: str = "development"
    secret_key: str = "dev-secret-key-change-me"

    database_url: str = "postgresql+asyncpg://yoz:yoz@localhost:5432/yoz"
    redis_url: str = "redis://localhost:6379/0"

    s3_endpoint_url: str = "http://localhost:9000"
    # Пусто = относительный путь ("/yoz-media/..."): браузер сам подставит текущий
    # хост, а Next.js/Caddy проксируют этот путь на MinIO (см. next.config.mjs,
    # Caddyfile). Так же, как с NEXT_PUBLIC_API_BASE_URL, это не завязано на
    # конкретный домен и работает и локально, и через туннель/LAN, и на проде.
    s3_public_url: str = ""
    s3_access_key: str = "yozminio"
    s3_secret_key: str = "yozminio123"
    s3_bucket: str = "yoz-media"
    s3_region: str = "us-east-1"

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "no-reply@yoz.local"

    frontend_base_url: str = "http://localhost:3000"
    # Доп. источники, которым разрешено обращаться к API (CORS/CSRF), через запятую —
    # для одновременного доступа с localhost, LAN и временного публичного туннеля.
    extra_allowed_origins: str = ""

    session_cookie_name: str = "yoz_session"
    csrf_cookie_name: str = "yoz_csrf"
    session_ttl_seconds: int = 60 * 60 * 24 * 30  # 30 дней

    email_verification_ttl_seconds: int = 60 * 15  # 15 минут — код, а не ссылка
    email_verification_max_attempts: int = 5
    password_reset_ttl_seconds: int = 60 * 60  # 1 час
    two_factor_challenge_ttl_seconds: int = 60 * 5  # 5 минут

    support_contact: str = "support@yoz.local"

    @property
    def is_production(self) -> bool:
        return self.env == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
