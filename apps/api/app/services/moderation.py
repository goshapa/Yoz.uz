import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.moderation_log import ModerationAction, ModerationLogEntry, ModerationTargetType


async def log_action(
    db: AsyncSession,
    actor_id: uuid.UUID,
    action: ModerationAction,
    target_type: ModerationTargetType,
    target_id: uuid.UUID,
    reason: str | None = None,
) -> None:
    db.add(
        ModerationLogEntry(
            actor_id=actor_id, action=action, target_type=target_type, target_id=target_id, reason=reason
        )
    )
    await db.commit()
