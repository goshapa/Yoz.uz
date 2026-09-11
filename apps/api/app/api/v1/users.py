import asyncio

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import delete, exists, func, or_, select, tuple_
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_current_user_optional
from app.core.security import verify_password
from app.db.session import get_db
from app.models.interactions import Block, Follow
from app.models.notification import NotificationType
from app.models.post import Post
from app.models.post_image import PostImage
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.post import FeedPage, PostAuthor
from app.schemas.user import USERNAME_RE, DeleteAccountRequest, FollowListPage, ProfileOut, UserMe
from app.services.activity_feed import paginate_activity
from app.services.blocks import get_related_block_ids, is_blocked
from app.services.images import process_upload
from app.services.notifications import notify
from app.services.pagination import clamp_limit, decode_cursor, encode_cursor
from app.services.post_serializer import serialize_posts, to_author
from app.services.storage import upload_object

router = APIRouter(prefix="/users", tags=["users"])

BIO_MAX_LENGTH = 160
DISPLAY_NAME_MAX_LENGTH = 50


@router.get("/me", response_model=UserMe)
async def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserMe)
async def update_current_user(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    display_name: str | None = Form(default=None),
    username: str | None = Form(default=None),
    bio: str | None = Form(default=None),
    city: str | None = Form(default=None),
    website: str | None = Form(default=None),
    avatar: UploadFile | None = File(default=None),
    cover: UploadFile | None = File(default=None),
):
    if display_name is not None:
        display_name = display_name.strip()
        if not (1 <= len(display_name) <= DISPLAY_NAME_MAX_LENGTH):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail=f"Отображаемое имя должно быть от 1 до {DISPLAY_NAME_MAX_LENGTH} символов",
            )
        current_user.display_name = display_name

    if username is not None:
        username = username.strip()
        if not USERNAME_RE.match(username):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail="Username: 3-20 символов, латинские буквы, цифры и нижнее подчёркивание",
            )
        if username.lower() != current_user.username.lower():
            existing = await db.execute(
                select(User).where(func.lower(User.username) == username.lower(), User.id != current_user.id)
            )
            if existing.scalar_one_or_none() is not None:
                raise HTTPException(status.HTTP_409_CONFLICT, detail="Такой username уже существует")
        current_user.username = username

    if bio is not None:
        bio = bio.strip()
        if len(bio) > BIO_MAX_LENGTH:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, detail=f"Описание не длиннее {BIO_MAX_LENGTH} символов"
            )
        current_user.bio = bio or None

    if city is not None:
        current_user.city = city.strip() or None

    if website is not None:
        current_user.website = website.strip() or None

    if avatar is not None and avatar.filename:
        processed = await process_upload(avatar)
        current_user.avatar_url = await asyncio.to_thread(
            upload_object, processed.original_bytes, processed.content_type, processed.extension
        )

    if cover is not None and cover.filename:
        processed = await process_upload(cover)
        current_user.cover_url = await asyncio.to_thread(
            upload_object, processed.original_bytes, processed.content_type, processed.extension
        )

    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.post("/me/delete", response_model=MessageResponse)
async def delete_current_user(
    payload: DeleteAccountRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Удаляет аккаунт безвозвратно. Сессии, посты, реакции и подписки удаляются
    каскадно на уровне БД (ON DELETE CASCADE от users.id)."""
    if not verify_password(payload.password, current_user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Неверный пароль")

    await db.delete(current_user)
    await db.commit()
    return MessageResponse(message="Аккаунт удалён")


@router.get("/suggestions/follow", response_model=list[PostAuthor])
async def follow_suggestions(
    limit: int = 12,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Кого предложить зафолловить — используется на онбординге новых пользователей
    (пустая лента «Подписки»). Основатель — всегда первым, дальше по числу подписчиков."""
    limit = clamp_limit(limit)
    following_ids = select(Follow.followee_id).where(Follow.follower_id == current_user.id)
    blocked_ids = await get_related_block_ids(db, current_user.id)

    followers_count = (
        select(Follow.followee_id, func.count().label("followers_count"))
        .group_by(Follow.followee_id)
        .subquery()
    )

    query = (
        select(User)
        .outerjoin(followers_count, followers_count.c.followee_id == User.id)
        .where(
            User.id != current_user.id,
            User.id.not_in(following_ids),
            User.is_suspended.is_(False),
        )
    )
    if blocked_ids:
        query = query.where(User.id.not_in(blocked_ids))

    query = query.order_by(
        User.is_founder.desc(),
        func.coalesce(followers_count.c.followers_count, 0).desc(),
        User.created_at.asc(),
    ).limit(limit)

    users = (await db.execute(query)).scalars().all()
    return [to_author(u) for u in users]


async def _get_profile_user(db: AsyncSession, username: str) -> User:
    result = await db.execute(select(User).where(func.lower(User.username) == username.lower()))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")
    return user


def _profile_out(
    user: User,
    followers_count: int,
    following_count: int,
    is_following: bool,
    is_self: bool,
    is_blocked_by_viewer: bool = False,
) -> ProfileOut:
    return ProfileOut(
        id=user.id,
        display_name=user.display_name,
        username=user.username,
        avatar_url=user.avatar_url,
        cover_url=user.cover_url,
        bio=user.bio,
        city=user.city,
        website=user.website,
        is_founder=user.is_founder,
        created_at=user.created_at,
        followers_count=followers_count,
        following_count=following_count,
        is_following=is_following,
        is_self=is_self,
        is_blocked_by_viewer=is_blocked_by_viewer,
    )


@router.get("/{username}", response_model=ProfileOut)
async def get_profile(
    username: str,
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    user = await _get_profile_user(db, username)

    followers_count = (
        await db.execute(select(func.count()).select_from(Follow).where(Follow.followee_id == user.id))
    ).scalar_one()
    following_count = (
        await db.execute(select(func.count()).select_from(Follow).where(Follow.follower_id == user.id))
    ).scalar_one()

    is_self = current_user is not None and current_user.id == user.id
    is_following = False
    is_blocked_by_viewer = False
    if current_user is not None and not is_self:
        is_following = (
            await db.execute(
                select(Follow).where(Follow.follower_id == current_user.id, Follow.followee_id == user.id)
            )
        ).scalar_one_or_none() is not None
        is_blocked_by_viewer = (
            await db.execute(
                select(Block).where(Block.blocker_id == current_user.id, Block.blocked_id == user.id)
            )
        ).scalar_one_or_none() is not None

    return _profile_out(user, followers_count, following_count, is_following, is_self, is_blocked_by_viewer)


@router.get("/{username}/followers", response_model=FollowListPage)
async def list_followers(
    username: str,
    cursor: str | None = None,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Список подписчиков виден только владельцу аккаунта — приватность по ТЗ."""
    target = await _get_profile_user(db, username)
    if current_user.id != target.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Список подписчиков виден только владельцу аккаунта")
    limit = clamp_limit(limit)

    query = (
        select(User, Follow.created_at)
        .join(Follow, Follow.follower_id == User.id)
        .where(Follow.followee_id == target.id)
    )
    if cursor:
        cursor_at, cursor_id = decode_cursor(cursor)
        query = query.where(tuple_(Follow.created_at, Follow.follower_id) < (cursor_at, cursor_id))
    query = query.order_by(Follow.created_at.desc(), Follow.follower_id.desc()).limit(limit + 1)

    rows = (await db.execute(query)).all()
    has_more = len(rows) > limit
    rows = rows[:limit]

    items = [to_author(u) for u, _ in rows]
    next_cursor = encode_cursor(rows[-1][1], rows[-1][0].id) if has_more and rows else None
    return FollowListPage(items=items, next_cursor=next_cursor)


@router.get("/{username}/following", response_model=FollowListPage)
async def list_following(
    username: str,
    cursor: str | None = None,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Список подписок виден только владельцу аккаунта — приватность по ТЗ."""
    target = await _get_profile_user(db, username)
    if current_user.id != target.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Список подписок виден только владельцу аккаунта")
    limit = clamp_limit(limit)

    query = (
        select(User, Follow.created_at)
        .join(Follow, Follow.followee_id == User.id)
        .where(Follow.follower_id == target.id)
    )
    if cursor:
        cursor_at, cursor_id = decode_cursor(cursor)
        query = query.where(tuple_(Follow.created_at, Follow.followee_id) < (cursor_at, cursor_id))
    query = query.order_by(Follow.created_at.desc(), Follow.followee_id.desc()).limit(limit + 1)

    rows = (await db.execute(query)).all()
    has_more = len(rows) > limit
    rows = rows[:limit]

    items = [to_author(u) for u, _ in rows]
    next_cursor = encode_cursor(rows[-1][1], rows[-1][0].id) if has_more and rows else None
    return FollowListPage(items=items, next_cursor=next_cursor)


@router.post("/{username}/follow", response_model=MessageResponse)
async def follow_user(
    username: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    target = await _get_profile_user(db, username)
    if target.id == current_user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Нельзя подписаться на себя")
    if await is_blocked(db, current_user.id, target.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Подписка недоступна из-за блокировки")

    stmt = (
        pg_insert(Follow)
        .values(follower_id=current_user.id, followee_id=target.id)
        .on_conflict_do_nothing(index_elements=[Follow.follower_id, Follow.followee_id])
    )
    result = await db.execute(stmt)
    await db.commit()
    if result.rowcount > 0:
        await notify(db, target.id, current_user.id, NotificationType.follow)
    return MessageResponse(message="Вы подписались")


@router.delete("/{username}/follow", response_model=MessageResponse)
async def unfollow_user(
    username: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    target = await _get_profile_user(db, username)
    await db.execute(delete(Follow).where(Follow.follower_id == current_user.id, Follow.followee_id == target.id))
    await db.commit()
    return MessageResponse(message="Вы отписались")


@router.post("/{username}/block", response_model=MessageResponse)
async def block_user(
    username: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    target = await _get_profile_user(db, username)
    if target.id == current_user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Нельзя заблокировать себя")

    await db.execute(
        pg_insert(Block)
        .values(blocker_id=current_user.id, blocked_id=target.id)
        .on_conflict_do_nothing(index_elements=[Block.blocker_id, Block.blocked_id])
    )
    # Блокировка удаляет подписки между аккаунтами в обе стороны (ТЗ п.9).
    await db.execute(
        delete(Follow).where(
            or_(
                (Follow.follower_id == current_user.id) & (Follow.followee_id == target.id),
                (Follow.follower_id == target.id) & (Follow.followee_id == current_user.id),
            )
        )
    )
    await db.commit()
    return MessageResponse(message="Пользователь заблокирован")


@router.delete("/{username}/block", response_model=MessageResponse)
async def unblock_user(
    username: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    target = await _get_profile_user(db, username)
    await db.execute(delete(Block).where(Block.blocker_id == current_user.id, Block.blocked_id == target.id))
    await db.commit()
    return MessageResponse(message="Пользователь разблокирован")


@router.get("/{username}/posts", response_model=FeedPage)
async def user_posts(
    username: str,
    cursor: str | None = None,
    limit: int = 20,
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """Вкладка «Публикации и репосты» — собственные посты пользователя и его репосты."""
    target = await _get_profile_user(db, username)
    limit = clamp_limit(limit)
    return await paginate_activity(db, [target.id], cursor, limit, current_user.id if current_user else None)


@router.get("/{username}/replies", response_model=FeedPage)
async def user_replies(
    username: str,
    cursor: str | None = None,
    limit: int = 20,
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    target = await _get_profile_user(db, username)
    limit = clamp_limit(limit)

    query = select(Post).where(
        Post.author_id == target.id,
        Post.parent_post_id.is_not(None),
        Post.deleted_at.is_(None),
        Post.is_hidden.is_(False),
    )
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


@router.get("/{username}/media", response_model=FeedPage)
async def user_media(
    username: str,
    cursor: str | None = None,
    limit: int = 20,
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    target = await _get_profile_user(db, username)
    limit = clamp_limit(limit)

    has_image = exists().where(PostImage.post_id == Post.id)
    query = select(Post).where(
        Post.author_id == target.id,
        Post.deleted_at.is_(None),
        Post.is_hidden.is_(False),
        has_image,
    )
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
