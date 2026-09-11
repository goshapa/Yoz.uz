from fastapi import APIRouter, Depends
from sqlalchemy import select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.interactions import Bookmark
from app.models.post import Post
from app.models.user import User
from app.schemas.post import FeedPage
from app.services.pagination import clamp_limit, decode_cursor, encode_cursor
from app.services.post_serializer import serialize_posts

router = APIRouter(prefix="/bookmarks", tags=["bookmarks"])


@router.get("", response_model=FeedPage)
async def list_bookmarks(
    cursor: str | None = None,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Закладки доступны только владельцу — зависимость get_current_user это гарантирует."""
    limit = clamp_limit(limit)

    query = (
        select(Post, Bookmark.created_at)
        .join(Bookmark, Bookmark.post_id == Post.id)
        .where(Bookmark.user_id == current_user.id, Post.deleted_at.is_(None), Post.is_hidden.is_(False))
    )
    if cursor:
        cursor_created_at, cursor_id = decode_cursor(cursor)
        query = query.where(tuple_(Bookmark.created_at, Post.id) < (cursor_created_at, cursor_id))
    query = query.order_by(Bookmark.created_at.desc(), Post.id.desc()).limit(limit + 1)

    rows = (await db.execute(query)).all()
    has_more = len(rows) > limit
    rows = rows[:limit]
    posts = [row[0] for row in rows]

    items = await serialize_posts(db, posts, current_user.id)
    next_cursor = encode_cursor(rows[-1][1], rows[-1][0].id) if has_more and rows else None
    return FeedPage(items=items, next_cursor=next_cursor)
