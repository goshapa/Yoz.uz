import uuid
from datetime import datetime

from pydantic import BaseModel

from app.schemas.post import PostAuthor


class NotificationOut(BaseModel):
    id: uuid.UUID
    type: str
    actor: PostAuthor
    post_id: uuid.UUID | None
    post_preview: str | None
    actor_count: int
    created_at: datetime
    read_at: datetime | None


class NotificationPage(BaseModel):
    items: list[NotificationOut]
    next_cursor: str | None


class UnreadCount(BaseModel):
    count: int
