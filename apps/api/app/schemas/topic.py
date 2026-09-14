import uuid

from pydantic import BaseModel


class UniversityOption(BaseModel):
    """Публичный список для выбора вуза при регистрации/в настройках — без
    счётчиков участников и без привязки к правам на просмотр сообщества."""

    id: uuid.UUID
    name_ru: str
    name_uz: str
    name_en: str


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
