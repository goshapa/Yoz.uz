import uuid
from collections import defaultdict
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.interactions import Bookmark, Like, Repost
from app.models.post import Post
from app.models.post_image import PostImage
from app.models.user import User
from app.schemas.post import PostAuthor, PostImageOut, PostOut


def to_author(user: User | None) -> PostAuthor | None:
    if user is None:
        return None
    return PostAuthor(
        id=user.id,
        display_name=user.display_name,
        username=user.username,
        avatar_url=user.avatar_url,
        is_founder=user.is_founder,
    )


async def serialize_posts(
    db: AsyncSession,
    posts: list[Post],
    viewer_id: uuid.UUID | None,
    repost_meta: dict[uuid.UUID, tuple[uuid.UUID, datetime]] | None = None,
) -> list[PostOut]:
    """Батчево собирает PostOut для списка постов: авторы, изображения, счётчики
    и флаги текущего пользователя (лайк/репост/закладка) — без N+1 запросов на пост."""
    if not posts:
        return []

    post_ids = [p.id for p in posts]

    user_ids = {p.author_id for p in posts}
    user_ids.update(p.reply_to_user_id for p in posts if p.reply_to_user_id)
    if repost_meta:
        user_ids.update(reposter_id for reposter_id, _ in repost_meta.values())

    users_result = await db.execute(select(User).where(User.id.in_(user_ids)))
    users_by_id = {u.id: u for u in users_result.scalars()}

    images_result = await db.execute(
        select(PostImage).where(PostImage.post_id.in_(post_ids)).order_by(PostImage.position)
    )
    images_by_post: dict[uuid.UUID, list[PostImage]] = defaultdict(list)
    for image in images_result.scalars():
        images_by_post[image.post_id].append(image)

    async def counts_by(column) -> dict[uuid.UUID, int]:
        result = await db.execute(select(column, func.count()).where(column.in_(post_ids)).group_by(column))
        return dict(result.all())

    likes_count = await counts_by(Like.post_id)
    reposts_count = await counts_by(Repost.post_id)

    replies_result = await db.execute(
        select(Post.parent_post_id, func.count())
        .where(
            Post.parent_post_id.in_(post_ids),
            Post.deleted_at.is_(None),
            Post.is_hidden.is_(False),
        )
        .group_by(Post.parent_post_id)
    )
    replies_count = dict(replies_result.all())

    liked_ids: set[uuid.UUID] = set()
    reposted_ids: set[uuid.UUID] = set()
    bookmarked_ids: set[uuid.UUID] = set()
    if viewer_id is not None:
        liked_ids = set(
            (
                await db.execute(
                    select(Like.post_id).where(Like.user_id == viewer_id, Like.post_id.in_(post_ids))
                )
            ).scalars()
        )
        reposted_ids = set(
            (
                await db.execute(
                    select(Repost.post_id).where(Repost.user_id == viewer_id, Repost.post_id.in_(post_ids))
                )
            ).scalars()
        )
        bookmarked_ids = set(
            (
                await db.execute(
                    select(Bookmark.post_id).where(
                        Bookmark.user_id == viewer_id, Bookmark.post_id.in_(post_ids)
                    )
                )
            ).scalars()
        )

    items: list[PostOut] = []
    for post in posts:
        reposted_by = None
        reposted_at = None
        if repost_meta and post.id in repost_meta:
            reposter_id, reposted_at = repost_meta[post.id]
            reposted_by = to_author(users_by_id.get(reposter_id))

        items.append(
            PostOut(
                id=post.id,
                author=to_author(users_by_id.get(post.author_id)),
                text=post.text,
                topic_id=post.topic_id,
                city=post.city,
                images=[
                    PostImageOut(
                        id=img.id,
                        url=img.url,
                        thumbnail_url=img.thumbnail_url,
                        width=img.width,
                        height=img.height,
                        alt_text=img.alt_text,
                    )
                    for img in images_by_post.get(post.id, [])
                ],
                video_url=post.video_url,
                parent_post_id=post.parent_post_id,
                reply_to=to_author(users_by_id.get(post.reply_to_user_id))
                if post.reply_to_user_id
                else None,
                created_at=post.created_at,
                likes_count=likes_count.get(post.id, 0),
                reposts_count=reposts_count.get(post.id, 0),
                replies_count=replies_count.get(post.id, 0),
                liked_by_viewer=post.id in liked_ids,
                reposted_by_viewer=post.id in reposted_ids,
                bookmarked_by_viewer=post.id in bookmarked_ids,
                reposted_by=reposted_by,
                reposted_at=reposted_at,
                is_hidden=post.is_hidden,
                hidden_reason=post.hidden_reason if post.is_hidden else None,
            )
        )

    return items
