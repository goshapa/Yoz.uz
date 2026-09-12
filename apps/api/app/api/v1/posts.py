import asyncio
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import delete, select, tuple_
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_current_user_optional
from app.db.session import get_db
from app.models.interactions import Bookmark, Like, Repost
from app.models.notification import NotificationType
from app.models.post import Post
from app.models.post_image import PostImage
from app.models.topic import Topic
from app.models.user import User, UserRole
from app.schemas.auth import MessageResponse
from app.schemas.post import FeedPage, PostOut
from app.services.blocks import is_blocked
from app.services.images import MAX_IMAGES_PER_POST, process_upload
from app.services.notifications import notify
from app.services.pagination import clamp_limit, decode_cursor, encode_cursor
from app.services.post_serializer import serialize_posts
from app.services.rate_limit import user_rate_limiter
from app.services.storage import upload_object
from app.services.tags import attach_hashtags_and_mentions
from app.services.videos import process_video_upload

router = APIRouter(prefix="/posts", tags=["posts"])

MAX_TEXT_LENGTH = 500


async def _get_visible_post(db: AsyncSession, post_id: uuid.UUID, viewer: User | None) -> Post:
    result = await db.execute(select(Post).where(Post.id == post_id, Post.deleted_at.is_(None)))
    post = result.scalar_one_or_none()
    if post is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Публикация не найдена")
    can_see_hidden = viewer is not None and (viewer.role != UserRole.user or viewer.id == post.author_id)
    if post.is_hidden and not can_see_hidden:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Публикация не найдена")
    return post


@router.post(
    "",
    response_model=PostOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(user_rate_limiter("create-post", max_requests=30, window_seconds=60 * 10))],
)
async def create_post(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    text: str | None = Form(default=None),
    topic_id: uuid.UUID | None = Form(default=None),
    city: str | None = Form(default=None),
    parent_post_id: uuid.UUID | None = Form(default=None),
    reply_to_user_id: uuid.UUID | None = Form(default=None),
    alt_texts: list[str] = Form(default=[]),
    images: list[UploadFile] = File(default=[]),
    video: UploadFile | None = File(default=None),
):
    clean_text = text.strip() if text else None
    if clean_text is not None and len(clean_text) > MAX_TEXT_LENGTH:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"Текст не длиннее {MAX_TEXT_LENGTH} символов")

    images = [f for f in images if f.filename]
    has_video = video is not None and bool(video.filename)
    if len(images) > MAX_IMAGES_PER_POST:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Не более 4 изображений")
    if images and has_video:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="В одной публикации можно прикрепить либо фото, либо видео")
    if not clean_text and not images and not has_video:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Публикация не может быть пустой")

    resolved_topic_id = topic_id
    resolved_city = city
    resolved_reply_to = reply_to_user_id
    root_parent_id: uuid.UUID | None = None

    if parent_post_id is not None:
        target = await _get_visible_post(db, parent_post_id, current_user)
        if await is_blocked(db, current_user.id, target.author_id):
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Ответ недоступен из-за блокировки")

        # Обсуждение всегда плоское: если отвечают на ответ, привязываем к корневому посту,
        # а адресатом по умолчанию становится автор того сообщения, на которое отвечали.
        root_parent_id = target.parent_post_id or target.id
        if resolved_reply_to is None:
            resolved_reply_to = target.author_id

        root_post = target if root_parent_id == target.id else await _get_visible_post(
            db, root_parent_id, current_user
        )
        resolved_topic_id = root_post.topic_id
        resolved_city = root_post.city

        if resolved_reply_to is not None:
            addressee = await db.get(User, resolved_reply_to)
            if addressee is None:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Адресат ответа не найден")
    elif resolved_topic_id is not None:
        topic = await db.get(Topic, resolved_topic_id)
        if topic is None or not topic.is_active:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Недопустимая тема")

    video_url = await process_video_upload(video) if has_video else None

    post = Post(
        author_id=current_user.id,
        text=clean_text,
        topic_id=resolved_topic_id,
        city=resolved_city.strip() if resolved_city else None,
        parent_post_id=root_parent_id,
        reply_to_user_id=resolved_reply_to,
        video_url=video_url,
    )
    db.add(post)
    await db.flush()

    for position, image_file in enumerate(images):
        processed = await process_upload(image_file)
        # boto3 — блокирующий клиент, выполняем сетевые вызовы в отдельном потоке.
        url = await asyncio.to_thread(
            upload_object, processed.original_bytes, processed.content_type, processed.extension
        )
        thumb_url = await asyncio.to_thread(
            upload_object, processed.thumbnail_bytes, processed.content_type, processed.extension
        )
        alt_text = alt_texts[position].strip() if position < len(alt_texts) and alt_texts[position] else None
        db.add(
            PostImage(
                post_id=post.id,
                url=url,
                thumbnail_url=thumb_url,
                width=processed.width,
                height=processed.height,
                alt_text=alt_text,
                position=position,
            )
        )

    mentioned_user_ids = await attach_hashtags_and_mentions(db, post.id, clean_text)

    await db.commit()
    await db.refresh(post)

    if root_parent_id is not None and resolved_reply_to is not None:
        await notify(db, resolved_reply_to, current_user.id, NotificationType.reply, post.id)
    for mentioned_id in mentioned_user_ids:
        await notify(db, mentioned_id, current_user.id, NotificationType.mention, post.id)

    items = await serialize_posts(db, [post], current_user.id)
    return items[0]


@router.get("/{post_id}", response_model=PostOut)
async def get_post(
    post_id: uuid.UUID,
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    post = await _get_visible_post(db, post_id, current_user)
    items = await serialize_posts(db, [post], current_user.id if current_user else None)
    return items[0]


@router.delete("/{post_id}", response_model=MessageResponse)
async def delete_post(
    post_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    post = await db.get(Post, post_id)
    if post is None or post.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Публикация не найдена")
    if post.author_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Нельзя удалить чужую публикацию")

    post.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    return MessageResponse(message="Публикация удалена")


@router.get("/{post_id}/replies", response_model=FeedPage)
async def list_replies(
    post_id: uuid.UUID,
    cursor: str | None = None,
    limit: int = 20,
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    await _get_visible_post(db, post_id, current_user)
    limit = clamp_limit(limit)
    is_staff = current_user is not None and current_user.role != UserRole.user

    query = select(Post).where(Post.parent_post_id == post_id, Post.deleted_at.is_(None))
    if not is_staff:
        query = query.where(Post.is_hidden.is_(False))
    if cursor:
        cursor_created_at, cursor_id = decode_cursor(cursor)
        query = query.where(tuple_(Post.created_at, Post.id) > (cursor_created_at, cursor_id))

    query = query.order_by(Post.created_at.asc(), Post.id.asc()).limit(limit + 1)
    rows = list((await db.execute(query)).scalars())

    has_more = len(rows) > limit
    rows = rows[:limit]

    items = await serialize_posts(db, rows, current_user.id if current_user else None)
    next_cursor = encode_cursor(rows[-1].created_at, rows[-1].id) if has_more and rows else None
    return FeedPage(items=items, next_cursor=next_cursor)


async def _toggle_on(db: AsyncSession, model, current_user: User, post: Post) -> bool:
    """Возвращает True, только если строка была реально вставлена (а не уже
    существовала) — повторный запрос не должен ни дублировать реакцию, ни слать
    повторное уведомление."""
    pk_columns = [c.name for c in model.__table__.primary_key.columns]
    stmt = pg_insert(model).values(user_id=current_user.id, post_id=post.id).on_conflict_do_nothing(
        index_elements=pk_columns
    )
    result = await db.execute(stmt)
    await db.commit()
    return result.rowcount > 0


async def _toggle_off(db: AsyncSession, model, current_user: User, post_id: uuid.UUID) -> None:
    await db.execute(delete(model).where(model.user_id == current_user.id, model.post_id == post_id))
    await db.commit()


@router.post("/{post_id}/like", response_model=MessageResponse)
async def like_post(
    post_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    post = await _get_visible_post(db, post_id, current_user)
    if await is_blocked(db, current_user.id, post.author_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Реакция недоступна из-за блокировки")
    if await _toggle_on(db, Like, current_user, post):
        await notify(db, post.author_id, current_user.id, NotificationType.like, post.id)
    return MessageResponse(message="Лайк добавлен")


@router.delete("/{post_id}/like", response_model=MessageResponse)
async def unlike_post(
    post_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _toggle_off(db, Like, current_user, post_id)
    return MessageResponse(message="Лайк отменён")


@router.post("/{post_id}/repost", response_model=MessageResponse)
async def repost_post(
    post_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    post = await _get_visible_post(db, post_id, current_user)
    if await is_blocked(db, current_user.id, post.author_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Реакция недоступна из-за блокировки")
    if await _toggle_on(db, Repost, current_user, post):
        await notify(db, post.author_id, current_user.id, NotificationType.repost, post.id)
    return MessageResponse(message="Репост сделан")


@router.delete("/{post_id}/repost", response_model=MessageResponse)
async def unrepost_post(
    post_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _toggle_off(db, Repost, current_user, post_id)
    return MessageResponse(message="Репост отменён")


@router.post("/{post_id}/bookmark", response_model=MessageResponse)
async def bookmark_post(
    post_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    post = await _get_visible_post(db, post_id, current_user)
    await _toggle_on(db, Bookmark, current_user, post)
    return MessageResponse(message="Добавлено в закладки")


@router.delete("/{post_id}/bookmark", response_model=MessageResponse)
async def unbookmark_post(
    post_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _toggle_off(db, Bookmark, current_user, post_id)
    return MessageResponse(message="Убрано из закладок")
