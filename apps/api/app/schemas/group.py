import uuid
from datetime import datetime

from pydantic import BaseModel, field_validator

from app.schemas.message import ReactionSummary
from app.schemas.post import PostAuthor

TITLE_MAX_LENGTH = 100
DESCRIPTION_MAX_LENGTH = 500


class GroupMemberOut(PostAuthor):
    role: str


class GroupOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    avatar_url: str | None
    member_count: int
    is_owner: bool
    created_at: datetime
    members: list[GroupMemberOut]


class GroupSummary(BaseModel):
    """Карточка группы в общем списке чатов — рядом с 1:1 перепиской."""

    id: uuid.UUID
    title: str
    avatar_url: str | None
    member_count: int
    last_message_text: str | None
    last_message_attachment_type: str | None
    last_message_at: datetime
    last_message_sender_name: str | None
    unread_count: int


class GroupListPage(BaseModel):
    items: list[GroupSummary]
    next_cursor: str | None


class CreateGroupRequest(BaseModel):
    title: str
    description: str | None = None
    member_usernames: list[str]

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        v = v.strip()
        if not (1 <= len(v) <= TITLE_MAX_LENGTH):
            raise ValueError(f"Название группы должно быть от 1 до {TITLE_MAX_LENGTH} символов")
        return v

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if len(v) > DESCRIPTION_MAX_LENGTH:
            raise ValueError(f"Описание не длиннее {DESCRIPTION_MAX_LENGTH} символов")
        return v or None

    @field_validator("member_usernames")
    @classmethod
    def validate_members(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("Добавьте хотя бы одного участника")
        return v


class UpdateGroupRequest(BaseModel):
    title: str | None = None
    description: str | None = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if not (1 <= len(v) <= TITLE_MAX_LENGTH):
            raise ValueError(f"Название группы должно быть от 1 до {TITLE_MAX_LENGTH} символов")
        return v

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if len(v) > DESCRIPTION_MAX_LENGTH:
            raise ValueError(f"Описание не длиннее {DESCRIPTION_MAX_LENGTH} символов")
        return v or None


class AddGroupMembersRequest(BaseModel):
    usernames: list[str]

    @field_validator("usernames")
    @classmethod
    def validate_usernames(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("Укажите хотя бы одного пользователя")
        return v


class GroupMessageOut(BaseModel):
    id: uuid.UUID
    group_id: uuid.UUID
    sender: PostAuthor
    text: str | None
    attachment_url: str | None
    attachment_thumbnail_url: str | None
    attachment_type: str | None
    forwarded_from: PostAuthor | None
    reactions: list[ReactionSummary]
    created_at: datetime
    edited_at: datetime | None
    is_deleted: bool


class GroupMessagePage(BaseModel):
    items: list[GroupMessageOut]
    next_cursor: str | None
