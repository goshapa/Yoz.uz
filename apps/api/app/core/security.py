import hashlib
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except VerifyMismatchError:
        return False


def generate_token(n_bytes: int = 32) -> str:
    """Криптостойкий токен для сессий и сброса пароля."""
    return secrets.token_urlsafe(n_bytes)


def generate_otp_code() -> str:
    """6-значный числовой код для подтверждения email (вводится вручную на сайте)."""
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_token(token: str) -> str:
    """Быстрый хеш для опознавательных токенов (сессии, verify/reset-ссылки).

    Это не пароль пользователя — секретность обеспечивается энтропией
    generate_token(), поэтому здесь достаточно SHA-256, а не Argon2id."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
