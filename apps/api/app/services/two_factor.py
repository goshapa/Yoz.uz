import secrets
import uuid

import pyotp

from app.core.config import get_settings
from app.db.redis import get_redis

_CHALLENGE_PREFIX = "2fa-challenge:"


def generate_secret() -> str:
    return pyotp.random_base32()


def provisioning_uri(secret: str, email: str) -> str:
    return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name="Yoz")


def verify_code(secret: str, code: str) -> bool:
    return pyotp.TOTP(secret).verify(code, valid_window=1)


async def create_login_challenge(user_id: uuid.UUID) -> str:
    """Короткоживущий токен, связывающий успешную проверку пароля со вторым
    шагом (код из приложения-аутентификатора) — сессия ещё не создаётся."""
    settings = get_settings()
    token = secrets.token_urlsafe(32)
    redis = get_redis()
    await redis.set(f"{_CHALLENGE_PREFIX}{token}", str(user_id), ex=settings.two_factor_challenge_ttl_seconds)
    return token


async def resolve_login_challenge(token: str) -> uuid.UUID | None:
    redis = get_redis()
    key = f"{_CHALLENGE_PREFIX}{token}"
    raw_user_id = await redis.get(key)
    if raw_user_id is None:
        return None
    await redis.delete(key)
    return uuid.UUID(raw_user_id)
