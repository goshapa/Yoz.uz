import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_current_user_optional
from app.db.session import get_db
from app.models.interactions import Follow
from app.models.post import Post
from app.models.user import User, UserRole
from app.schemas.post import FeedPage
from app.services.activity_feed import paginate_activity
from app.services.blocks import get_related_block_ids
from app.services.pagination import clamp_limit, decode_cursor, encode_cursor
from app.services.post_serializer import serialize_posts

router = APIRouter(prefix="/feed", tags=["feed"])


@router.get("/following", response_model=FeedPage)
async def following_feed(
    cursor: str | None = None,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Посты и репосты пользователей, на которых подписан текущий пользователь
    (плюс его собственные посты), от новых к старым по времени активности."""
    limit = clamp_limit(limit)

    followee_ids = set(
        (await db.execute(select(Follow.followee_id).where(Follow.follower_id == current_user.id))).scalars()
    )
    followee_ids.add(current_user.id)
    followee_ids -= await get_related_block_ids(db, current_user.id)

    return await paginate_activity(db, list(followee_ids), cursor, limit, current_user.id)


@router.get("/overview", response_model=FeedPage)
async def overview_feed(
    cursor: str | None = None,
    limit: int = 20,
    topic: uuid.UUID | None = None,
    city: str | None = None,
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """Публичные публикации сообщества (без репостов), от новых к старым,
    с необязательными фильтрами по теме и городу. Публикации заблокированных
    друг другом аккаунтов скрываются из персональной ленты авторизованного пользователя."""
    limit = clamp_limit(limit)

    if topic is not None:
        is_staff = current_user is not None and current_user.role != UserRole.user
        if not is_staff and (current_user is None or current_user.university_topic_id != topic):
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Сообщество недоступно")

    query = select(Post).where(
        Post.parent_post_id.is_(None), Post.deleted_at.is_(None), Post.is_hidden.is_(False)
    )
    if topic is not None:
        query = query.where(Post.topic_id == topic)
    else:
        # Без фильтра по теме это общая лента "Все темы"/рекомендации — любой
        # пост, привязанный к сообществу, туда не подмешиваем (он живёт только
        # в своей ленте сообщества), а не только помеченные community_only.
        query = query.where(Post.topic_id.is_(None))
    if city:
        query = query.where(Post.city.ilike(city))

    if current_user is not None:
        blocked_ids = await get_related_block_ids(db, current_user.id)
        if blocked_ids:
            query = query.where(Post.author_id.not_in(blocked_ids))

    if cursor:
        cursor_created_at, cursor_id = decode_cursor(cursor)
        query = query.where(tuple_(Post.created_at, Post.id) < (cursor_created_at, cursor_id))

    query = query.order_by(Post.created_at.desc(), Post.id.desc()).limit(limit + 1)
    rows = list((await db.execute(query)).scalars())

    has_more = len(rows) > limit
    rows = rows[:limit]

    items = await serialize_posts(db, rows, current_user.id if current_user else None)
    next_cursor = encode_cursor(rows[-1].created_at, rows[-1].id) if has_more and rows else None
    return FeedPage(items=items, next_cursor=next_cursor)
