import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification, NotificationType
from app.services.blocks import is_blocked

# Лайки и репосты на один и тот же пост объединяются в одну непрочитанную запись
# (ТЗ п.8: «Объединение повторяющихся реакций на одну публикацию»).
_GROUPABLE_TYPES = {NotificationType.like, NotificationType.repost}


async def notify(
    db: AsyncSession,
    recipient_id: uuid.UUID,
    actor_id: uuid.UUID,
    ntype: NotificationType,
    post_id: uuid.UUID | None = None,
) -> None:
    if recipient_id == actor_id:
        return
    if await is_blocked(db, recipient_id, actor_id):
        return

    if ntype in _GROUPABLE_TYPES and post_id is not None:
        existing = (
            await db.execute(
                select(Notification).where(
                    Notification.recipient_id == recipient_id,
                    Notification.type == ntype,
                    Notification.post_id == post_id,
                    Notification.read_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if existing is not None:
            existing.actor_id = actor_id
            existing.actor_count += 1
            existing.created_at = datetime.now(timezone.utc)
            await db.commit()
            return

    db.add(Notification(recipient_id=recipient_id, actor_id=actor_id, type=ntype, post_id=post_id))
    await db.commit()
