import uuid
from datetime import datetime

from pydantic import BaseModel, field_validator

from app.schemas.post import PostAuthor

MESSAGE_TEXT_MAX_LENGTH = 2000


class ReactionSummary(BaseModel):
    emoji: str
    count: int
    reacted_by_viewer: bool


class ReplyPreview(BaseModel):
    id: uuid.UUID
    sender_id: uuid.UUID
    text: str | None
    attachment_type: str | None
    is_deleted: bool


class DirectMessageOut(BaseModel):
    id: uuid.UUID
    sender_id: uuid.UUID
    text: str | None
    attachment_url: str | None
    attachment_thumbnail_url: str | None
    attachment_type: str | None
    reply_to: ReplyPreview | None
    reactions: list[ReactionSummary]
    created_at: datetime
    read_at: datetime | None
    edited_at: datetime | None
    is_deleted: bool


class DirectMessagePage(BaseModel):
    items: list[DirectMessageOut]
    next_cursor: str | None


class ConversationOut(BaseModel):
    peer: PostAuthor
    last_message_text: str | None
    last_message_attachment_type: str | None
    last_message_at: datetime
    last_message_is_mine: bool
    unread_count: int


class ConversationPage(BaseModel):
    items: list[ConversationOut]
    next_cursor: str | None


class EditMessageRequest(BaseModel):
    text: str

    @field_validator("text")
    @classmethod
    def validate_text(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Сообщение не может быть пустым")
        if len(v) > MESSAGE_TEXT_MAX_LENGTH:
            raise ValueError(f"Сообщение не длиннее {MESSAGE_TEXT_MAX_LENGTH} символов")
        return v


class ReactionRequest(BaseModel):
    emoji: str

    @field_validator("emoji")
    @classmethod
    def validate_emoji(cls, v: str) -> str:
        v = v.strip()
        if not v or len(v) > 8:
            raise ValueError("Некорректный эмодзи")
        return v


class UnreadTotal(BaseModel):
    count: int
