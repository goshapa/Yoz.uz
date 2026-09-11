import asyncio
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import delete, func, select, tuple_
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.group import GroupChat, GroupMember, GroupMessage, GroupMessageReaction, GroupRole
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.message import EditMessageRequest, ReactionRequest, ReactionSummary
from app.schemas.group import (
    AddGroupMembersRequest,
    CreateGroupRequest,
    GroupListPage,
    GroupMemberOut,
    GroupMessageOut,
    GroupMessagePage,
    GroupOut,
    GroupSummary,
    UpdateGroupRequest,
)
from app.services.images import process_upload
from app.services.message_attachments import process_message_attachment
from app.services.pagination import clamp_limit, decode_cursor, encode_cursor
from app.services.post_serializer import to_author
from app.services.rate_limit import user_rate_limiter
from app.services.storage import upload_object

router = APIRouter(prefix="/groups", tags=["groups"])

MESSAGE_TEXT_MAX_LENGTH = 2000


async def _get_membership(db: AsyncSession, group_id: uuid.UUID, user_id: uuid.UUID) -> GroupMember:
    member = await db.get(GroupMember, {"group_id": group_id, "user_id": user_id})
    if member is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Группа не найдена")
    return member


async def _get_group(db: AsyncSession, group_id: uuid.UUID) -> GroupChat:
    group = await db.get(GroupChat, group_id)
    if group is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Группа не найдена")
    return group


async def _resolve_usernames(db: AsyncSession, usernames: list[str], exclude_id: uuid.UUID | None = None) -> list[User]:
    lowered = {u.lower() for u in usernames}
    result = await db.execute(select(User).where(func.lower(User.username).in_(lowered)))
    users = list(result.scalars())
    if exclude_id is not None:
        users = [u for u in users if u.id != exclude_id]
    if not users:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Пользователи не найдены")
    return users


@router.post("", response_model=GroupOut, status_code=status.HTTP_201_CREATED)
async def create_group(
    payload: CreateGroupRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    members = await _resolve_usernames(db, payload.member_usernames, exclude_id=current_user.id)

    group = GroupChat(title=payload.title, description=payload.description, created_by_id=current_user.id)
    db.add(group)
    await db.flush()

    db.add(GroupMember(group_id=group.id, user_id=current_user.id, role=GroupRole.owner))
    for member in members:
        db.add(GroupMember(group_id=group.id, user_id=member.id, role=GroupRole.member))
    await db.commit()

    return await _group_out(db, group, current_user.id)


async def _group_out(db: AsyncSession, group: GroupChat, viewer_id: uuid.UUID) -> GroupOut:
    rows = (
        await db.execute(
            select(GroupMember, User).join(User, User.id == GroupMember.user_id).where(GroupMember.group_id == group.id)
        )
    ).all()
    members = [GroupMemberOut(**to_author(u).model_dump(), role=m.role.value) for m, u in rows]
    is_owner = any(m.user_id == viewer_id and m.role == GroupRole.owner for m, _ in rows)
    return GroupOut(
        id=group.id,
        title=group.title,
        description=group.description,
        avatar_url=group.avatar_url,
        member_count=len(members),
        is_owner=is_owner,
        created_at=group.created_at,
        members=members,
    )


@router.get("", response_model=GroupListPage)
async def list_groups(
    cursor: str | None = None,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    limit = clamp_limit(limit)

    query = (
        select(GroupChat, GroupMember)
        .join(GroupMember, GroupMember.group_id == GroupChat.id)
        .where(GroupMember.user_id == current_user.id)
    )
    if cursor:
        cursor_at, cursor_id = decode_cursor(cursor)
        query = query.where(tuple_(GroupChat.last_message_at, GroupChat.id) < (cursor_at, cursor_id))
    query = query.order_by(GroupChat.last_message_at.desc(), GroupChat.id.desc()).limit(limit + 1)

    rows = (await db.execute(query)).all()
    has_more = len(rows) > limit
    rows = rows[:limit]
    if not rows:
        return GroupListPage(items=[], next_cursor=None)

    group_ids = [g.id for g, _ in rows]

    member_counts = dict(
        (await db.execute(
            select(GroupMember.group_id, func.count()).where(GroupMember.group_id.in_(group_ids)).group_by(GroupMember.group_id)
        )).all()
    )

    last_messages_result = await db.execute(
        select(GroupMessage)
        .distinct(GroupMessage.group_id)
        .where(GroupMessage.group_id.in_(group_ids), GroupMessage.deleted_at.is_(None))
        .order_by(GroupMessage.group_id, GroupMessage.created_at.desc())
    )
    last_message_by_group = {m.group_id: m for m in last_messages_result.scalars()}

    sender_ids = {m.sender_id for m in last_message_by_group.values()}
    senders_by_id = {}
    if sender_ids:
        senders_by_id = {u.id: u for u in (await db.execute(select(User).where(User.id.in_(sender_ids)))).scalars()}

    items = []
    for group, membership in rows:
        cleared_at = membership.cleared_at
        last_message = last_message_by_group.get(group.id)
        if last_message is None or (cleared_at is not None and last_message.created_at <= cleared_at):
            continue

        unread_count = 0
        if membership.last_read_at is None or membership.last_read_at < last_message.created_at:
            # Точный подсчёт только непрочитанных (не всех чужих сообщений) — дороже,
            # но список групп короткий, лишний запрос на группу не проблема.
            floor = membership.last_read_at or membership.joined_at
            unread_count = (
                await db.execute(
                    select(func.count())
                    .select_from(GroupMessage)
                    .where(
                        GroupMessage.group_id == group.id,
                        GroupMessage.sender_id != current_user.id,
                        GroupMessage.deleted_at.is_(None),
                        GroupMessage.created_at > floor,
                    )
                )
            ).scalar_one()

        sender = senders_by_id.get(last_message.sender_id)
        items.append(
            GroupSummary(
                id=group.id,
                title=group.title,
                avatar_url=group.avatar_url,
                member_count=member_counts.get(group.id, 0),
                last_message_text=last_message.text,
                last_message_attachment_type=last_message.attachment_type.value if last_message.attachment_type else None,
                last_message_at=last_message.created_at,
                last_message_sender_name=sender.display_name if sender else None,
                unread_count=unread_count,
            )
        )

    next_cursor = encode_cursor(rows[-1][0].last_message_at, rows[-1][0].id) if has_more and rows else None
    return GroupListPage(items=items, next_cursor=next_cursor)


@router.get("/{group_id}", response_model=GroupOut)
async def get_group(
    group_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_membership(db, group_id, current_user.id)
    group = await _get_group(db, group_id)
    return await _group_out(db, group, current_user.id)


@router.patch("/{group_id}", response_model=GroupOut)
async def update_group(
    group_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    title: str | None = Form(default=None),
    description: str | None = Form(default=None),
    avatar: UploadFile | None = File(default=None),
):
    membership = await _get_membership(db, group_id, current_user.id)
    if membership.role != GroupRole.owner:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Изменять группу может только владелец")
    group = await _get_group(db, group_id)

    payload = UpdateGroupRequest(title=title, description=description)
    if payload.title is not None:
        group.title = payload.title
    if description is not None:
        group.description = payload.description

    if avatar is not None and avatar.filename:
        processed = await process_upload(avatar)
        group.avatar_url = await asyncio.to_thread(
            upload_object, processed.original_bytes, processed.content_type, processed.extension
        )

    await db.commit()
    await db.refresh(group)
    return await _group_out(db, group, current_user.id)


@router.post("/{group_id}/members", response_model=GroupOut)
async def add_group_members(
    group_id: uuid.UUID,
    payload: AddGroupMembersRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_membership(db, group_id, current_user.id)
    group = await _get_group(db, group_id)

    existing_ids = {
        row[0]
        for row in (await db.execute(select(GroupMember.user_id).where(GroupMember.group_id == group_id))).all()
    }
    to_add = [u for u in await _resolve_usernames(db, payload.usernames) if u.id not in existing_ids]
    for user in to_add:
        db.add(GroupMember(group_id=group_id, user_id=user.id, role=GroupRole.member))
    await db.commit()

    return await _group_out(db, group, current_user.id)


@router.delete("/{group_id}/members/{user_id}", response_model=MessageResponse)
async def remove_group_member(
    group_id: uuid.UUID,
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    membership = await _get_membership(db, group_id, current_user.id)
    is_self = user_id == current_user.id
    if not is_self and membership.role != GroupRole.owner:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Удалять участников может только владелец")

    target = await db.get(GroupMember, {"group_id": group_id, "user_id": user_id})
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Участник не найден")
    if target.role == GroupRole.owner and is_self:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="Владелец не может покинуть группу — сначала удалите группу"
        )

    await db.delete(target)
    await db.commit()
    return MessageResponse(message="Готово" if is_self else "Участник удалён")


async def _serialize_group_messages(
    db: AsyncSession, messages: list[GroupMessage], viewer_id: uuid.UUID
) -> list[GroupMessageOut]:
    if not messages:
        return []
    message_ids = [m.id for m in messages]

    user_ids = {m.sender_id for m in messages} | {m.forwarded_from_id for m in messages if m.forwarded_from_id}
    users_by_id = {u.id: u for u in (await db.execute(select(User).where(User.id.in_(user_ids)))).scalars()}

    reactions_result = await db.execute(
        select(GroupMessageReaction).where(GroupMessageReaction.message_id.in_(message_ids))
    )
    reactions_by_message: dict[uuid.UUID, list[GroupMessageReaction]] = {}
    for r in reactions_result.scalars():
        reactions_by_message.setdefault(r.message_id, []).append(r)

    def reaction_summaries(message_id: uuid.UUID) -> list[ReactionSummary]:
        rows = reactions_by_message.get(message_id, [])
        counts: dict[str, int] = {}
        viewer_emoji: str | None = None
        for r in rows:
            counts[r.emoji] = counts.get(r.emoji, 0) + 1
            if r.user_id == viewer_id:
                viewer_emoji = r.emoji
        return [
            ReactionSummary(emoji=emoji, count=count, reacted_by_viewer=emoji == viewer_emoji)
            for emoji, count in counts.items()
        ]

    items = []
    for m in messages:
        sender = users_by_id.get(m.sender_id)
        items.append(
            GroupMessageOut(
                id=m.id,
                group_id=m.group_id,
                sender=to_author(sender),
                text=None if m.deleted_at else m.text,
                attachment_url=None if m.deleted_at else m.attachment_url,
                attachment_thumbnail_url=None if m.deleted_at else m.attachment_thumbnail_url,
                attachment_type=None if m.deleted_at or not m.attachment_type else m.attachment_type.value,
                forwarded_from=to_author(users_by_id.get(m.forwarded_from_id)) if m.forwarded_from_id else None,
                reactions=reaction_summaries(m.id),
                created_at=m.created_at,
                edited_at=m.edited_at,
                is_deleted=m.deleted_at is not None,
            )
        )
    return items


@router.get("/{group_id}/messages", response_model=GroupMessagePage)
async def get_group_messages(
    group_id: uuid.UUID,
    cursor: str | None = None,
    limit: int = 30,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    membership = await _get_membership(db, group_id, current_user.id)
    limit = clamp_limit(limit)

    query = select(GroupMessage).where(GroupMessage.group_id == group_id)
    if membership.cleared_at is not None:
        query = query.where(GroupMessage.created_at > membership.cleared_at)
    if cursor:
        cursor_at, cursor_id = decode_cursor(cursor)
        query = query.where(tuple_(GroupMessage.created_at, GroupMessage.id) < (cursor_at, cursor_id))
    query = query.order_by(GroupMessage.created_at.desc(), GroupMessage.id.desc()).limit(limit + 1)

    rows = list((await db.execute(query)).scalars())
    has_more = len(rows) > limit
    rows = rows[:limit]

    if cursor is None:
        membership.last_read_at = datetime.now(timezone.utc)
        await db.commit()

    items = await _serialize_group_messages(db, rows, current_user.id)
    next_cursor = encode_cursor(rows[-1].created_at, rows[-1].id) if has_more and rows else None
    return GroupMessagePage(items=items, next_cursor=next_cursor)


@router.post(
    "/{group_id}/messages",
    response_model=GroupMessageOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(user_rate_limiter("send-group-message", max_requests=120, window_seconds=60 * 10))],
)
async def send_group_message(
    group_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    text: str | None = Form(default=None),
    forwarded_from_id: uuid.UUID | None = Form(default=None),
    attachment: UploadFile | None = File(default=None),
):
    await _get_membership(db, group_id, current_user.id)
    group = await _get_group(db, group_id)

    clean_text = text.strip() if text else None
    if clean_text is not None and len(clean_text) > MESSAGE_TEXT_MAX_LENGTH:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"Сообщение не длиннее {MESSAGE_TEXT_MAX_LENGTH} символов")

    has_attachment = attachment is not None and bool(attachment.filename)
    if not clean_text and not has_attachment:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Сообщение не может быть пустым")

    resolved_forwarded_from: uuid.UUID | None = None
    if forwarded_from_id is not None and await db.get(User, forwarded_from_id) is not None:
        resolved_forwarded_from = forwarded_from_id

    attachment_type = attachment_url = attachment_thumbnail_url = None
    if has_attachment:
        processed = await process_message_attachment(attachment)
        attachment_type = processed.attachment_type
        attachment_url = processed.url
        attachment_thumbnail_url = processed.thumbnail_url

    message = GroupMessage(
        group_id=group_id,
        sender_id=current_user.id,
        text=clean_text,
        forwarded_from_id=resolved_forwarded_from,
        attachment_type=attachment_type,
        attachment_url=attachment_url,
        attachment_thumbnail_url=attachment_thumbnail_url,
    )
    group.last_message_at = func.now()
    db.add(message)
    await db.commit()
    await db.refresh(message)

    items = await _serialize_group_messages(db, [message], current_user.id)
    return items[0]


async def _get_own_group_message(db: AsyncSession, group_id: uuid.UUID, message_id: uuid.UUID, current_user: User) -> GroupMessage:
    await _get_membership(db, group_id, current_user.id)
    message = await db.get(GroupMessage, message_id)
    if message is None or message.group_id != group_id or message.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Сообщение не найдено")
    if message.sender_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Можно изменять только свои сообщения")
    return message


@router.patch("/{group_id}/messages/{message_id}", response_model=GroupMessageOut)
async def edit_group_message(
    group_id: uuid.UUID,
    message_id: uuid.UUID,
    payload: EditMessageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    message = await _get_own_group_message(db, group_id, message_id, current_user)
    message.text = payload.text
    message.edited_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(message)

    items = await _serialize_group_messages(db, [message], current_user.id)
    return items[0]


async def _get_visible_group_message(
    db: AsyncSession, group_id: uuid.UUID, message_id: uuid.UUID, current_user: User
) -> GroupMessage:
    await _get_membership(db, group_id, current_user.id)
    message = await db.get(GroupMessage, message_id)
    if message is None or message.group_id != group_id or message.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Сообщение не найдено")
    return message


@router.put("/{group_id}/messages/{message_id}/reactions", response_model=GroupMessageOut)
async def set_group_reaction(
    group_id: uuid.UUID,
    message_id: uuid.UUID,
    payload: ReactionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    message = await _get_visible_group_message(db, group_id, message_id, current_user)
    await db.execute(
        pg_insert(GroupMessageReaction)
        .values(message_id=message.id, user_id=current_user.id, emoji=payload.emoji)
        .on_conflict_do_update(
            index_elements=[GroupMessageReaction.message_id, GroupMessageReaction.user_id],
            set_={"emoji": payload.emoji},
        )
    )
    await db.commit()
    items = await _serialize_group_messages(db, [message], current_user.id)
    return items[0]


@router.delete("/{group_id}/messages/{message_id}/reactions", response_model=GroupMessageOut)
async def remove_group_reaction(
    group_id: uuid.UUID,
    message_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    message = await _get_visible_group_message(db, group_id, message_id, current_user)
    await db.execute(
        delete(GroupMessageReaction).where(
            GroupMessageReaction.message_id == message.id, GroupMessageReaction.user_id == current_user.id
        )
    )
    await db.commit()
    items = await _serialize_group_messages(db, [message], current_user.id)
    return items[0]


@router.delete("/{group_id}/messages/{message_id}", response_model=MessageResponse)
async def delete_group_message(
    group_id: uuid.UUID,
    message_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    message = await _get_own_group_message(db, group_id, message_id, current_user)
    message.deleted_at = datetime.now(timezone.utc)
    message.text = None
    message.attachment_url = None
    message.attachment_thumbnail_url = None
    message.attachment_type = None
    await db.execute(delete(GroupMessageReaction).where(GroupMessageReaction.message_id == message.id))
    await db.commit()
    return MessageResponse(message="Сообщение удалено")


@router.delete("/{group_id}", response_model=MessageResponse)
async def clear_group_chat(
    group_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """«Удалить чат» — прячет историю только для текущего участника, группу не удаляет
    (кроме случая когда её покидает последний оставшийся участник)."""
    membership = await _get_membership(db, group_id, current_user.id)
    membership.cleared_at = datetime.now(timezone.utc)
    await db.commit()
    return MessageResponse(message="Чат удалён")
