import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ModerationAction(str, enum.Enum):
    hide_post = "hide_post"
    unhide_post = "unhide_post"
    suspend_user = "suspend_user"
    unsuspend_user = "unsuspend_user"
    assign_role = "assign_role"
    resolve_report = "resolve_report"
    create_topic = "create_topic"
    update_topic = "update_topic"


class ModerationTargetType(str, enum.Enum):
    post = "post"
    user = "user"
    report = "report"
    topic = "topic"


class ModerationLogEntry(Base):
    __tablename__ = "moderation_log"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    action: Mapped[ModerationAction] = mapped_column(Enum(ModerationAction, name="moderation_action"), nullable=False)
    target_type: Mapped[ModerationTargetType] = mapped_column(
        Enum(ModerationTargetType, name="moderation_target_type"), nullable=False
    )
    target_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
