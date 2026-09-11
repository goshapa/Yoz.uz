from fastapi import Depends, HTTPException, Request, status

from app.api.deps import get_current_user
from app.db.redis import get_redis
from app.models.user import User


async def _check_and_incr(key: str, max_requests: int, window_seconds: int) -> None:
    redis = get_redis()
    current = await redis.incr(key)
    if current == 1:
        await redis.expire(key, window_seconds)

    if current > max_requests:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Слишком много попыток. Попробуйте позже.",
        )


def rate_limiter(key_prefix: str, max_requests: int, window_seconds: int):
    """Простой fixed-window rate limiter на Redis, привязанный к IP клиента.

    Подходит для анонимных эндпоинтов (вход, регистрация)."""

    async def dependency(request: Request) -> None:
        client_ip = request.client.host if request.client else "unknown"
        await _check_and_incr(f"rl:{key_prefix}:{client_ip}", max_requests, window_seconds)

    return dependency


def user_rate_limiter(key_prefix: str, max_requests: int, window_seconds: int):
    """Fixed-window rate limiter, привязанный к аккаунту, а не к IP — для действий,
    доступных только авторизованным пользователям (публикации, жалобы)."""

    async def dependency(current_user: User = Depends(get_current_user)) -> None:
        await _check_and_incr(f"rl:{key_prefix}:{current_user.id}", max_requests, window_seconds)

    return dependency
