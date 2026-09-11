import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.notification import Notification
from app.models.post import Post
from app.models.user import User
from app.schemas.notification import NotificationOut, NotificationPage, UnreadCount
from app.services.pagination import clamp_limit, decode_cursor, encode_cursor
from app.services.post_serializer import to_author

router = APIRouter(prefix="/notifications", tags=["notifications"])


async def _unread_count(db: AsyncSession, user_id: uuid.UUID) -> int:
    return (
        await db.execute(
            select(func.count())
            .select_from(Notification)
            .where(Notification.recipient_id == user_id, Notification.read_at.is_(None))
        )
    ).scalar_one()


@router.get("", response_model=NotificationPage)
async def list_notifications(
    cursor: str | None = None,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    limit = clamp_limit(limit)

    query = select(Notification).where(Notification.recipient_id == current_user.id)
    if cursor:
        cursor_created_at, cursor_id = decode_cursor(cursor)
        query = query.where(tuple_(Notification.created_at, Notification.id) < (cursor_created_at, cursor_id))
    query = query.order_by(Notification.created_at.desc(), Notification.id.desc()).limit(limit + 1)

    rows = list((await db.execute(query)).scalars())
    has_more = len(rows) > limit
    rows = rows[:limit]

    actor_ids = {n.actor_id for n in rows}
    post_ids = {n.post_id for n in rows if n.post_id is not None}

    actors_by_id = {u.id: u for u in (await db.execute(select(User).where(User.id.in_(actor_ids)))).scalars()}
    posts_by_id = (
        {p.id: p for p in (await db.execute(select(Post).where(Post.id.in_(post_ids)))).scalars()}
        if post_ids
        else {}
    )

    items = [
        NotificationOut(
            id=n.id,
            type=n.type.value,
            actor=to_author(actors_by_id.get(n.actor_id)),
            post_id=n.post_id,
            post_preview=(posts_by_id[n.post_id].text[:80] if n.post_id in posts_by_id and posts_by_id[n.post_id].text else None),
            actor_count=n.actor_count,
            created_at=n.created_at,
            read_at=n.read_at,
        )
        for n in rows
    ]

    next_cursor = encode_cursor(rows[-1].created_at, rows[-1].id) if has_more and rows else None
    return NotificationPage(items=items, next_cursor=next_cursor)


@router.get("/unread-count", response_model=UnreadCount)
async def unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return UnreadCount(count=await _unread_count(db, current_user.id))


@router.post("/read-all", response_model=UnreadCount)
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        Notification.__table__.update()
        .where(Notification.recipient_id == current_user.id, Notification.read_at.is_(None))
        .values(read_at=datetime.now(timezone.utc))
    )
    await db.commit()
    return UnreadCount(count=0)


@router.post("/{notification_id}/read", response_model=UnreadCount)
async def mark_read(
    notification_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    notif = await db.get(Notification, notification_id)
    if notif is not None and notif.recipient_id == current_user.id and notif.read_at is None:
        notif.read_at = datetime.now(timezone.utc)
        await db.commit()

    return UnreadCount(count=await _unread_count(db, current_user.id))
