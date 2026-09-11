import enum
import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AttachmentType(str, enum.Enum):
    image = "image"
    video = "video"


class Conversation(Base):
    """Личный диалог 1:1. user_a_id всегда меньше user_b_id (сравнение UUID) —
    это гарантирует единственную запись на пару пользователей независимо от
    того, кто первый написал."""

    __tablename__ = "conversations"
    __table_args__ = (
        UniqueConstraint("user_a_id", "user_b_id", name="uq_conversations_pair"),
        CheckConstraint("user_a_id < user_b_id", name="ck_conversations_ordered_pair"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_a_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_b_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_message_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    # "Удалить чат" — прячет историю только для одной стороны, не трогая данные
    # собеседника. Сообщения, отправленные ДО этой отметки, не показываются
    # владельцу отметки; новая переписка снова делает диалог видимым.
    user_a_cleared_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    user_b_cleared_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class DirectMessage(Base):
    __tablename__ = "direct_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sender_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    reply_to_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("direct_messages.id", ondelete="SET NULL"), nullable=True
    )
    # Автор исходного сообщения при пересылке — не участник текущей переписки,
    # поэтому не переиспользуем reply_to_id (там превью резолвится в предположении
    # "либо я, либо собеседник", что для пересланного даёт неверное имя).
    forwarded_from_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    text: Mapped[str | None] = mapped_column(String(2000), nullable=True)

    attachment_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    attachment_thumbnail_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    attachment_type: Mapped[AttachmentType | None] = mapped_column(
        Enum(AttachmentType, name="direct_message_attachment_type"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    edited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Мягкое удаление — строка остаётся (на неё может ссылаться reply_to_id
    # других сообщений), но текст/вложение стираются и в UI показывается заглушка.
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class DirectMessageReaction(Base):
    """Одна реакция на сообщение от одного пользователя — повторная простановка
    другого эмодзи заменяет предыдущую (PK по паре сообщение+пользователь)."""

    __tablename__ = "direct_message_reactions"

    message_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("direct_messages.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    emoji: Mapped[str] = mapped_column(String(8), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
