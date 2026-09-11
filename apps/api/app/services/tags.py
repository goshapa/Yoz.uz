import uuid

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.hashtag import Hashtag, PostHashtag, PostMention
from app.models.user import User
from app.services.content import extract_hashtags, extract_mentions


async def attach_hashtags_and_mentions(
    db: AsyncSession, post_id: uuid.UUID, text: str | None
) -> list[uuid.UUID]:
    """Разбирает #хэштеги и @упоминания из текста поста, создаёт недостающие
    хэштеги и связи. Возвращает id упомянутых пользователей (для уведомлений)."""
    tags = extract_hashtags(text)
    for tag in tags:
        await db.execute(pg_insert(Hashtag).values(tag=tag).on_conflict_do_nothing(index_elements=[Hashtag.tag]))

    if tags:
        hashtag_ids = (await db.execute(select(Hashtag.id).where(Hashtag.tag.in_(tags)))).scalars()
        for hashtag_id in hashtag_ids:
            await db.execute(
                pg_insert(PostHashtag)
                .values(post_id=post_id, hashtag_id=hashtag_id)
                .on_conflict_do_nothing(index_elements=[PostHashtag.post_id, PostHashtag.hashtag_id])
            )

    usernames = extract_mentions(text)
    mentioned_user_ids: list[uuid.UUID] = []
    if usernames:
        mentioned_users = (
            await db.execute(select(User).where(func.lower(User.username).in_(usernames)))
        ).scalars()
        for user in mentioned_users:
            mentioned_user_ids.append(user.id)
            await db.execute(
                pg_insert(PostMention)
                .values(post_id=post_id, mentioned_user_id=user.id)
                .on_conflict_do_nothing(
                    index_elements=[PostMention.post_id, PostMention.mentioned_user_id]
                )
            )

    return mentioned_user_ids
