import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

from app.models.report import ReportStatus
from app.models.user import UserRole
from app.schemas.post import PostAuthor


class AdminReportOut(BaseModel):
    id: uuid.UUID
    reporter: PostAuthor
    target_type: str
    target_post_id: uuid.UUID | None
    target_user_id: uuid.UUID | None
    reason: str
    details: str | None
    status: str
    resolution_note: str | None
    created_at: datetime
    resolved_at: datetime | None


class AdminReportPage(BaseModel):
    items: list[AdminReportOut]
    next_cursor: str | None


class ResolveReportRequest(BaseModel):
    status: ReportStatus = ReportStatus.resolved
    resolution_note: str | None = None


class HidePostRequest(BaseModel):
    reason: str

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Укажите причину")
        return v


class SuspendUserRequest(BaseModel):
    reason: str

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Укажите причину")
        return v


class AssignRoleRequest(BaseModel):
    role: UserRole


class TopicCreate(BaseModel):
    slug: str
    name_ru: str
    name_uz: str
    name_en: str
    sort_order: int = 0


class TopicUpdate(BaseModel):
    name_ru: str | None = None
    name_uz: str | None = None
    name_en: str | None = None
    is_active: bool | None = None
    sort_order: int | None = None


class AdminTopicOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str
    name_ru: str
    name_uz: str
    name_en: str
    is_active: bool
    sort_order: int


class AdminUserOut(BaseModel):
    id: uuid.UUID
    display_name: str
    username: str
    email: str
    avatar_url: str | None
    role: str
    is_suspended: bool
    suspension_reason: str | None
    email_verified: bool
    is_founder: bool
    created_at: datetime
    last_seen_at: datetime


class AdminUserPage(BaseModel):
    items: list[AdminUserOut]
    next_cursor: str | None


class StatsOut(BaseModel):
    users_count: int
    posts_count: int
    open_reports_count: int
    suspended_users_count: int


class ModerationLogOut(BaseModel):
    id: uuid.UUID
    actor: PostAuthor | None
    action: str
    target_type: str
    target_id: uuid.UUID
    reason: str | None
    created_at: datetime


class ModerationLogPage(BaseModel):
    items: list[ModerationLogOut]
    next_cursor: str | None
