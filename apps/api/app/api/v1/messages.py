import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import delete, func, or_, select, tuple_
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.message import Conversation, DirectMessage, DirectMessageReaction
from app.models.user import User
from app.schemas.message import (
    ConversationOut,
    ConversationPage,
    DirectMessageOut,
    EditMessageRequest,
    ReactionRequest,
    ReactionSummary,
    ReplyPreview,
    DirectMessagePage,
    UnreadTotal,
)
from app.schemas.auth import MessageResponse
from app.services.blocks import is_blocked
from app.services.message_attachments import process_message_attachment
from app.services.pagination import clamp_limit, decode_cursor, encode_cursor
from app.services.post_serializer import to_author
from app.services.rate_limit import user_rate_limiter

router = APIRouter(prefix="/messages", tags=["messages"])

MESSAGE_TEXT_MAX_LENGTH = 2000


async def _get_target_user(db: AsyncSession, username: str) -> User:
    result = await db.execute(select(User).where(func.lower(User.username) == username.lower()))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")
    return user


def _ordered_pair(user_id: uuid.UUID, other_id: uuid.UUID) -> tuple[uuid.UUID, uuid.UUID]:
    return (user_id, other_id) if user_id < other_id else (other_id, user_id)


async def _find_conversation(db: AsyncSession, user_id: uuid.UUID, other_id: uuid.UUID) -> Conversation | None:
    user_a_id, user_b_id = _ordered_pair(user_id, other_id)
    result = await db.execute(
        select(Conversation).where(Conversation.user_a_id == user_a_id, Conversation.user_b_id == user_b_id)
    )
    return result.scalar_one_or_none()


def _cleared_at_for(conversation: Conversation, user_id: uuid.UUID) -> datetime | None:
    return conversation.user_a_cleared_at if conversation.user_a_id == user_id else conversation.user_b_cleared_at


async def _get_own_message(db: AsyncSession, message_id: uuid.UUID, current_user: User) -> DirectMessage:
    """Находит сообщение и проверяет, что текущий пользователь — участник его диалога
    и его автор. Используется для редактирования/удаления/снятия реакции."""
    message = await db.get(DirectMessage, message_id)
    if message is None or message.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Сообщение не найдено")
    if message.sender_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Можно изменять только свои сообщения")
    return message


async def _get_visible_message(db: AsyncSession, message_id: uuid.UUID, current_user: User) -> DirectMessage:
    """Находит сообщение и проверяет, что текущий пользователь — участник его диалога
    (для реакций — реагировать можно на чужие сообщения тоже)."""
    message = await db.get(DirectMessage, message_id)
    if message is None or message.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Сообщение не найдено")
    conversation = await db.get(Conversation, message.conversation_id)
    if conversation is None or current_user.id not in (conversation.user_a_id, conversation.user_b_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Сообщение не найдено")
    return message


async def _serialize_messages(
    db: AsyncSession, messages: list[DirectMessage], viewer_id: uuid.UUID
) -> list[DirectMessageOut]:
    if not messages:
        return []

    message_ids = [m.id for m in messages]
    reply_ids = {m.reply_to_id for m in messages if m.reply_to_id is not None}

    replies_by_id: dict[uuid.UUID, DirectMessage] = {}
    if reply_ids:
        replies_by_id = {
            m.id: m for m in (await db.execute(select(DirectMessage).where(DirectMessage.id.in_(reply_ids)))).scalars()
        }

    forwarder_ids = {m.forwarded_from_id for m in messages if m.forwarded_from_id is not None}
    forwarders_by_id: dict[uuid.UUID, User] = {}
    if forwarder_ids:
        forwarders_by_id = {
            u.id: u for u in (await db.execute(select(User).where(User.id.in_(forwarder_ids)))).scalars()
        }

    reactions_result = await db.execute(
        select(DirectMessageReaction).where(DirectMessageReaction.message_id.in_(message_ids))
    )
    reactions_by_message: dict[uuid.UUID, list[DirectMessageReaction]] = {}
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

    def reply_preview(message: DirectMessage) -> ReplyPreview | None:
        if message.reply_to_id is None:
            return None
        original = replies_by_id.get(message.reply_to_id)
        if original is None:
            return None
        return ReplyPreview(
            id=original.id,
            sender_id=original.sender_id,
            text=None if original.deleted_at else original.text,
            attachment_type=None if original.deleted_at or not original.attachment_type else original.attachment_type.value,
            is_deleted=original.deleted_at is not None,
        )

    items = []
    for m in messages:
        items.append(
            DirectMessageOut(
                id=m.id,
                sender_id=m.sender_id,
                text=m.text,
                attachment_url=m.attachment_url,
                attachment_thumbnail_url=m.attachment_thumbnail_url,
                attachment_type=m.attachment_type.value if m.attachment_type else None,
                reply_to=reply_preview(m),
                forwarded_from=to_author(forwarders_by_id.get(m.forwarded_from_id))
                if m.forwarded_from_id
                else None,
                reactions=reaction_summaries(m.id),
                created_at=m.created_at,
                read_at=m.read_at,
                edited_at=m.edited_at,
                is_deleted=m.deleted_at is not None,
            )
        )
    return items


async def _unread_total(db: AsyncSession, user_id: uuid.UUID) -> int:
    return (
        await db.execute(
            select(func.count())
            .select_from(DirectMessage)
            .join(Conversation, Conversation.id == DirectMessage.conversation_id)
            .where(
                or_(Conversation.user_a_id == user_id, Conversation.user_b_id == user_id),
                DirectMessage.sender_id != user_id,
                DirectMessage.read_at.is_(None),
                DirectMessage.deleted_at.is_(None),
            )
        )
    ).scalar_one()


@router.get("", response_model=ConversationPage)
async def list_conversations(
    cursor: str | None = None,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    limit = clamp_limit(limit)

    query = select(Conversation).where(
        or_(Conversation.user_a_id == current_user.id, Conversation.user_b_id == current_user.id)
    )
    if cursor:
        cursor_at, cursor_id = decode_cursor(cursor)
        query = query.where(tuple_(Conversation.last_message_at, Conversation.id) < (cursor_at, cursor_id))
    query = query.order_by(Conversation.last_message_at.desc(), Conversation.id.desc()).limit(limit + 1)

    conversations = list((await db.execute(query)).scalars())
    has_more = len(conversations) > limit
    conversations = conversations[:limit]

    if not conversations:
        return ConversationPage(items=[], next_cursor=None)

    conv_ids = [c.id for c in conversations]
    peer_ids = {
        (c.user_b_id if c.user_a_id == current_user.id else c.user_a_id) for c in conversations
    }
    peers_by_id = {u.id: u for u in (await db.execute(select(User).where(User.id.in_(peer_ids)))).scalars()}

    last_messages_result = await db.execute(
        select(DirectMessage)
        .distinct(DirectMessage.conversation_id)
        .where(DirectMessage.conversation_id.in_(conv_ids), DirectMessage.deleted_at.is_(None))
        .order_by(DirectMessage.conversation_id, DirectMessage.created_at.desc())
    )
    last_message_by_conv = {m.conversation_id: m for m in last_messages_result.scalars()}

    unread_result = await db.execute(
        select(DirectMessage.conversation_id, func.count())
        .where(
            DirectMessage.conversation_id.in_(conv_ids),
            DirectMessage.sender_id != current_user.id,
            DirectMessage.read_at.is_(None),
            DirectMessage.deleted_at.is_(None),
        )
        .group_by(DirectMessage.conversation_id)
    )
    unread_by_conv = dict(unread_result.all())

    items = []
    for c in conversations:
        cleared_at = _cleared_at_for(c, current_user.id)
        last_message = last_message_by_conv.get(c.id)
        if last_message is None or (cleared_at is not None and last_message.created_at <= cleared_at):
            continue
        peer_id = c.user_b_id if c.user_a_id == current_user.id else c.user_a_id
        items.append(
            ConversationOut(
                peer=to_author(peers_by_id.get(peer_id)),
                last_message_text=last_message.text,
                last_message_attachment_type=last_message.attachment_type.value
                if last_message.attachment_type
                else None,
                last_message_at=last_message.created_at,
                last_message_is_mine=last_message.sender_id == current_user.id,
                unread_count=unread_by_conv.get(c.id, 0),
            )
        )

    next_cursor = (
        encode_cursor(conversations[-1].last_message_at, conversations[-1].id) if has_more and conversations else None
    )
    return ConversationPage(items=items, next_cursor=next_cursor)


@router.get("/unread-count", response_model=UnreadTotal)
async def unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return UnreadTotal(count=await _unread_total(db, current_user.id))


@router.get("/{username}", response_model=DirectMessagePage)
async def get_conversation(
    username: str,
    cursor: str | None = None,
    limit: int = 30,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    target = await _get_target_user(db, username)
    limit = clamp_limit(limit)

    conversation = await _find_conversation(db, current_user.id, target.id)
    if conversation is None:
        return DirectMessagePage(items=[], next_cursor=None)

    query = select(DirectMessage).where(DirectMessage.conversation_id == conversation.id)
    cleared_at = _cleared_at_for(conversation, current_user.id)
    if cleared_at is not None:
        query = query.where(DirectMessage.created_at > cleared_at)
    if cursor:
        cursor_at, cursor_id = decode_cursor(cursor)
        query = query.where(tuple_(DirectMessage.created_at, DirectMessage.id) < (cursor_at, cursor_id))
    query = query.order_by(DirectMessage.created_at.desc(), DirectMessage.id.desc()).limit(limit + 1)

    rows = list((await db.execute(query)).scalars())
    has_more = len(rows) > limit
    rows = rows[:limit]

    if cursor is None:
        # Открытие переписки помечает входящие сообщения прочитанными — как и с уведомлениями.
        await db.execute(
            DirectMessage.__table__.update()
            .where(
                DirectMessage.conversation_id == conversation.id,
                DirectMessage.sender_id == target.id,
                DirectMessage.read_at.is_(None),
            )
            .values(read_at=datetime.now(timezone.utc))
        )
        await db.commit()

    items = await _serialize_messages(db, rows, current_user.id)
    next_cursor = encode_cursor(rows[-1].created_at, rows[-1].id) if has_more and rows else None
    return DirectMessagePage(items=items, next_cursor=next_cursor)


@router.post(
    "/{username}",
    response_model=DirectMessageOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(user_rate_limiter("send-message", max_requests=120, window_seconds=60 * 10))],
)
async def send_message(
    username: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    text: str | None = Form(default=None),
    reply_to_id: uuid.UUID | None = Form(default=None),
    forwarded_from_id: uuid.UUID | None = Form(default=None),
    attachment: UploadFile | None = File(default=None),
):
    target = await _get_target_user(db, username)
    if target.id == current_user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Нельзя написать самому себе")
    if await is_blocked(db, current_user.id, target.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Переписка недоступна из-за блокировки")

    clean_text = text.strip() if text else None
    if clean_text is not None and len(clean_text) > MESSAGE_TEXT_MAX_LENGTH:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"Сообщение не длиннее {MESSAGE_TEXT_MAX_LENGTH} символов")

    has_attachment = attachment is not None and bool(attachment.filename)
    if not clean_text and not has_attachment:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Сообщение не может быть пустым")

    conversation = await _find_conversation(db, current_user.id, target.id)
    if conversation is None:
        user_a_id, user_b_id = _ordered_pair(current_user.id, target.id)
        conversation = Conversation(user_a_id=user_a_id, user_b_id=user_b_id)
        db.add(conversation)
        await db.flush()

    resolved_reply_to: uuid.UUID | None = None
    if reply_to_id is not None:
        original = await db.get(DirectMessage, reply_to_id)
        if original is not None and original.conversation_id == conversation.id:
            resolved_reply_to = original.id

    resolved_forwarded_from: uuid.UUID | None = None
    if forwarded_from_id is not None and await db.get(User, forwarded_from_id) is not None:
        resolved_forwarded_from = forwarded_from_id

    attachment_type = None
    attachment_url = None
    attachment_thumbnail_url = None
    if has_attachment:
        processed = await process_message_attachment(attachment)
        attachment_type = processed.attachment_type
        attachment_url = processed.url
        attachment_thumbnail_url = processed.thumbnail_url

    message = DirectMessage(
        conversation_id=conversation.id,
        sender_id=current_user.id,
        text=clean_text,
        reply_to_id=resolved_reply_to,
        forwarded_from_id=resolved_forwarded_from,
        attachment_type=attachment_type,
        attachment_url=attachment_url,
        attachment_thumbnail_url=attachment_thumbnail_url,
    )
    conversation.last_message_at = func.now()
    db.add(message)
    await db.commit()
    await db.refresh(message)

    items = await _serialize_messages(db, [message], current_user.id)
    return items[0]


@router.patch("/{username}/{message_id}", response_model=DirectMessageOut)
async def edit_message(
    username: str,
    message_id: uuid.UUID,
    payload: EditMessageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    message = await _get_own_message(db, message_id, current_user)
    message.text = payload.text
    message.edited_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(message)

    items = await _serialize_messages(db, [message], current_user.id)
    return items[0]


@router.delete("/{username}/{message_id}", response_model=MessageResponse)
async def delete_message(
    username: str,
    message_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    message = await _get_own_message(db, message_id, current_user)
    message.deleted_at = datetime.now(timezone.utc)
    message.text = None
    message.attachment_url = None
    message.attachment_thumbnail_url = None
    message.attachment_type = None
    await db.execute(delete(DirectMessageReaction).where(DirectMessageReaction.message_id == message.id))
    await db.commit()
    return MessageResponse(message="Сообщение удалено")


@router.put("/{username}/{message_id}/reactions", response_model=DirectMessageOut)
async def set_reaction(
    username: str,
    message_id: uuid.UUID,
    payload: ReactionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    message = await _get_visible_message(db, message_id, current_user)
    await db.execute(
        pg_insert(DirectMessageReaction)
        .values(message_id=message.id, user_id=current_user.id, emoji=payload.emoji)
        .on_conflict_do_update(
            index_elements=[DirectMessageReaction.message_id, DirectMessageReaction.user_id],
            set_={"emoji": payload.emoji},
        )
    )
    await db.commit()
    items = await _serialize_messages(db, [message], current_user.id)
    return items[0]


@router.delete("/{username}/{message_id}/reactions", response_model=DirectMessageOut)
async def remove_reaction(
    username: str,
    message_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    message = await _get_visible_message(db, message_id, current_user)
    await db.execute(
        delete(DirectMessageReaction).where(
            DirectMessageReaction.message_id == message.id, DirectMessageReaction.user_id == current_user.id
        )
    )
    await db.commit()
    items = await _serialize_messages(db, [message], current_user.id)
    return items[0]


@router.delete("/{username}", response_model=MessageResponse)
async def clear_conversation(
    username: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """«Удалить чат» — прячет историю только для текущего пользователя."""
    target = await _get_target_user(db, username)
    conversation = await _find_conversation(db, current_user.id, target.id)
    if conversation is not None:
        now = datetime.now(timezone.utc)
        if conversation.user_a_id == current_user.id:
            conversation.user_a_cleared_at = now
        else:
            conversation.user_b_cleared_at = now
        await db.commit()
    return MessageResponse(message="Чат удалён")
