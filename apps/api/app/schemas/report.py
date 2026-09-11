import uuid

from pydantic import BaseModel, field_validator

from app.models.report import ReportReason, ReportTargetType

DETAILS_MAX_LENGTH = 500


class ReportCreate(BaseModel):
    target_type: ReportTargetType
    target_post_id: uuid.UUID | None = None
    target_user_id: uuid.UUID | None = None
    reason: ReportReason
    details: str | None = None

    @field_validator("details")
    @classmethod
    def validate_details(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if len(v) > DETAILS_MAX_LENGTH:
            raise ValueError(f"Пояснение не длиннее {DETAILS_MAX_LENGTH} символов")
        return v or None
