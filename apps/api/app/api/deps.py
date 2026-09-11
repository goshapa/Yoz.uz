from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import hash_token
from app.db.session import get_db
from app.models.session import Session
from app.models.user import User, UserRole

settings = get_settings()


async def _load_user_from_cookie(request: Request, db: AsyncSession) -> User | None:
    raw_token = request.cookies.get(settings.session_cookie_name)
    if not raw_token:
        return None

    token_hash = hash_token(raw_token)
    result = await db.execute(select(Session).where(Session.token_hash == token_hash))
    session = result.scalar_one_or_none()
    if session is None:
        return None

    if session.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        return None

    user_result = await db.execute(select(User).where(User.id == session.user_id))
    return user_result.scalar_one_or_none()


async def get_current_user_optional(
    request: Request, db: AsyncSession = Depends(get_db)
) -> User | None:
    return await _load_user_from_cookie(request, db)


async def get_current_user(
    request: Request, db: AsyncSession = Depends(get_db)
) -> User:
    user = await _load_user_from_cookie(request, db)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Требуется вход")
    if user.is_suspended:
        reason = user.suspension_reason or "не указана"
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Аккаунт ограничен. Причина: {reason}. Для обращения в поддержку: {settings.support_contact}",
        )
    return user


def require_role(*allowed: UserRole):
    """Зависимость для роутов панели администратора — доступ только указанным ролям."""

    async def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Недостаточно прав")
        return current_user

    return dependency


require_staff = require_role(UserRole.moderator, UserRole.admin)
require_admin = require_role(UserRole.admin)
