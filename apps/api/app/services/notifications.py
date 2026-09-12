import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification, NotificationType
from app.models.user import User
from app.services.blocks import is_blocked
from app.services.push import send_push_to_user

# Лайки и репосты на один и тот же пост объединяются в одну непрочитанную запись
# (ТЗ п.8: «Объединение повторяющихся реакций на одну публикацию»).
_GROUPABLE_TYPES = {NotificationType.like, NotificationType.repost}

_PUSH_PHRASES = {
    NotificationType.follow: "подписался(-лась) на вас",
    NotificationType.like: "оценил(а) вашу публикацию",
    NotificationType.repost: "сделал(а) репост вашей публикации",
    NotificationType.reply: "ответил(а) на вашу публикацию",
    NotificationType.mention: "упомянул(а) вас в публикации",
}


async def _send_push_for_notification(
    db: AsyncSession, recipient_id: uuid.UUID, actor_id: uuid.UUID, ntype: NotificationType, post_id: uuid.UUID | None
) -> None:
    actor = await db.get(User, actor_id)
    if actor is None:
        return
    url = f"/post/{post_id}" if post_id is not None else f"/u/{actor.username}"
    await send_push_to_user(db, recipient_id, actor.display_name, _PUSH_PHRASES[ntype], url)


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
            await _send_push_for_notification(db, recipient_id, actor_id, ntype, post_id)
            return

    db.add(Notification(recipient_id=recipient_id, actor_id=actor_id, type=ntype, post_id=post_id))
    await db.commit()
    await _send_push_for_notification(db, recipient_id, actor_id, ntype, post_id)
