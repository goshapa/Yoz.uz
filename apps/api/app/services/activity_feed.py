import uuid

from sqlalchemy import cast, literal, select, tuple_, union_all
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.interactions import Repost
from app.models.post import Post
from app.schemas.post import FeedPage
from app.services.pagination import decode_cursor, encode_cursor
from app.services.post_serializer import serialize_posts


async def paginate_activity(
    db: AsyncSession,
    author_ids: list[uuid.UUID],
    cursor: str | None,
    limit: int,
    viewer_id: uuid.UUID | None,
) -> FeedPage:
    """Лента постов и репостов заданных авторов — переиспользуется и лентой
    «Подписки», и вкладкой «Публикации и репосты» в профиле."""
    posts_activity = select(
        Post.id.label("post_id"),
        Post.created_at.label("activity_at"),
        cast(literal(None), PG_UUID(as_uuid=True)).label("repost_user_id"),
    ).where(
        Post.author_id.in_(author_ids),
        Post.parent_post_id.is_(None),
        Post.deleted_at.is_(None),
        Post.is_hidden.is_(False),
    )

    reposts_activity = (
        select(
            Repost.post_id.label("post_id"),
            Repost.created_at.label("activity_at"),
            Repost.user_id.label("repost_user_id"),
        )
        .join(Post, Post.id == Repost.post_id)
        .where(Repost.user_id.in_(author_ids), Post.deleted_at.is_(None), Post.is_hidden.is_(False))
    )

    activity = union_all(posts_activity, reposts_activity).subquery("activity")
    query = select(activity.c.post_id, activity.c.activity_at, activity.c.repost_user_id)

    if cursor:
        cursor_activity_at, cursor_post_id = decode_cursor(cursor)
        query = query.where(
            tuple_(activity.c.activity_at, activity.c.post_id) < (cursor_activity_at, cursor_post_id)
        )

    query = query.order_by(activity.c.activity_at.desc(), activity.c.post_id.desc()).limit(limit + 1)
    rows = (await db.execute(query)).all()

    has_more = len(rows) > limit
    rows = rows[:limit]

    post_ids = [row.post_id for row in rows]
    repost_meta = {
        row.post_id: (row.repost_user_id, row.activity_at) for row in rows if row.repost_user_id is not None
    }

    posts_by_id = {p.id: p for p in (await db.execute(select(Post).where(Post.id.in_(post_ids)))).scalars()}
    ordered_posts = [posts_by_id[row.post_id] for row in rows if row.post_id in posts_by_id]

    items = await serialize_posts(db, ordered_posts, viewer_id, repost_meta)
    next_cursor = encode_cursor(rows[-1].activity_at, rows[-1].post_id) if has_more and rows else None
    return FeedPage(items=items, next_cursor=next_cursor)
