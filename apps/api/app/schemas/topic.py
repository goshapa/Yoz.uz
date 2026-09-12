import uuid

from pydantic import BaseModel


class TopicOut(BaseModel):
    id: uuid.UUID
    slug: str
    name_ru: str
    name_uz: str
    name_en: str
    members_count: int
    is_member: bool


class TopicMembershipOut(BaseModel):
    members_count: int
    is_member: bool
