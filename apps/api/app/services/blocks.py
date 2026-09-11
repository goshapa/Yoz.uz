import uuid

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.interactions import Block


async def is_blocked(db: AsyncSession, user_a: uuid.UUID, user_b: uuid.UUID) -> bool:
    """True, если между двумя пользователями есть блокировка в любую сторону."""
    result = await db.execute(
        select(Block.blocker_id).where(
            or_(
                (Block.blocker_id == user_a) & (Block.blocked_id == user_b),
                (Block.blocker_id == user_b) & (Block.blocked_id == user_a),
            )
        )
    )
    return result.first() is not None


async def get_related_block_ids(db: AsyncSession, user_id: uuid.UUID) -> set[uuid.UUID]:
    """Id всех пользователей, с которыми есть блокировка в любую сторону — чтобы
    исключить их публикации из персональной ленты, поиска и уведомлений."""
    result = await db.execute(
        select(Block.blocker_id, Block.blocked_id).where(
            or_(Block.blocker_id == user_id, Block.blocked_id == user_id)
        )
    )
    ids: set[uuid.UUID] = set()
    for blocker_id, blocked_id in result.all():
        ids.add(blocked_id if blocker_id == user_id else blocker_id)
    return ids
