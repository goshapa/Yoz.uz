import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import func, or_, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_optional
from app.db.session import get_db
from app.models.hashtag import Hashtag, PostHashtag
from app.models.post import Post
from app.models.user import User
from app.schemas.search import SearchResponse, SearchUser
from app.services.blocks import get_related_block_ids
from app.services.content import normalize_apostrophes
from app.services.pagination import clamp_limit, decode_cursor, encode_cursor
from app.services.post_serializer import serialize_posts

router = APIRouter(prefix="/search", tags=["search"])

# Варианты узбекского апострофа, которые могут встретиться в сохранённом тексте поста;
# приводим их к обычной кавычке "'" прямо в SQL, чтобы сравнить с нормализованным запросом.
_APOSTROPHE_VARIANTS = "’ʻ‘ʼ`"
_NORMALIZED_POST_TEXT = func.translate(Post.text, _APOSTROPHE_VARIANTS, "'" * len(_APOSTROPHE_VARIANTS))


@router.get("", response_model=SearchResponse)
async def search(
    q: str,
    topic: uuid.UUID | None = None,
    city: str | None = None,
    cursor: str | None = None,
    limit: int = 20,
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    query_text = q.strip()
    if not query_text:
        return SearchResponse(users=[], posts=[], posts_next_cursor=None)

    normalized_query = normalize_apostrophes(query_text)
    tag_query = normalized_query.lstrip("#").lower()
    limit = clamp_limit(limit)

    blocked_ids: set = set()
    if current_user is not None:
        blocked_ids = await get_related_block_ids(db, current_user.id)

    users_query = select(User).where(
        or_(
            User.display_name.ilike(f"%{query_text}%"),
            User.username.ilike(f"%{query_text}%"),
        )
    )
    if blocked_ids:
        users_query = users_query.where(User.id.not_in(blocked_ids))
    users_query = users_query.order_by(
        (func.lower(User.username) == query_text.lower()).desc(), User.username
    ).limit(10)

    users = [
        SearchUser(
            id=u.id,
            display_name=u.display_name,
            username=u.username,
            avatar_url=u.avatar_url,
            bio=u.bio,
            is_founder=u.is_founder,
        )
        for u in (await db.execute(users_query)).scalars()
    ]

    hashtag_post_ids = (
        select(PostHashtag.post_id).join(Hashtag, Hashtag.id == PostHashtag.hashtag_id).where(Hashtag.tag == tag_query)
    )

    posts_query = select(Post).where(
        or_(_NORMALIZED_POST_TEXT.ilike(f"%{normalized_query}%"), Post.id.in_(hashtag_post_ids)),
        Post.deleted_at.is_(None),
        Post.is_hidden.is_(False),
        Post.parent_post_id.is_(None),
    )
    if topic is not None:
        posts_query = posts_query.where(Post.topic_id == topic)
    if city:
        posts_query = posts_query.where(Post.city.ilike(city))
    if blocked_ids:
        posts_query = posts_query.where(Post.author_id.not_in(blocked_ids))

    if cursor:
        cursor_created_at, cursor_id = decode_cursor(cursor)
        posts_query = posts_query.where(tuple_(Post.created_at, Post.id) < (cursor_created_at, cursor_id))

    posts_query = posts_query.order_by(Post.created_at.desc(), Post.id.desc()).limit(limit + 1)
    rows = list((await db.execute(posts_query)).scalars())
    has_more = len(rows) > limit
    rows = rows[:limit]

    posts = await serialize_posts(db, rows, current_user.id if current_user else None)
    posts_next_cursor = encode_cursor(rows[-1].created_at, rows[-1].id) if has_more and rows else None

    return SearchResponse(users=users, posts=posts, posts_next_cursor=posts_next_cursor)
