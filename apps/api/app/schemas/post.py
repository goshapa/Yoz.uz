import uuid
from datetime import datetime

from pydantic import BaseModel


class PostAuthor(BaseModel):
    id: uuid.UUID
    display_name: str
    username: str
    avatar_url: str | None
    is_founder: bool = False


class PostImageOut(BaseModel):
    id: uuid.UUID
    url: str
    thumbnail_url: str
    width: int
    height: int
    alt_text: str | None


class PostOut(BaseModel):
    id: uuid.UUID
    author: PostAuthor
    text: str | None
    topic_id: uuid.UUID | None
    city: str | None
    images: list[PostImageOut]
    video_url: str | None
    parent_post_id: uuid.UUID | None
    reply_to: PostAuthor | None
    created_at: datetime

    likes_count: int
    reposts_count: int
    replies_count: int

    liked_by_viewer: bool
    reposted_by_viewer: bool
    bookmarked_by_viewer: bool

    # Заполнено, если это репост в ленте «Подписки» — кто и когда его сделал.
    reposted_by: PostAuthor | None = None
    reposted_at: datetime | None = None

    # Видно только автору и модераторам/администраторам — остальным скрытый пост
    # возвращается как 404 ещё на уровне эндпоинта.
    is_hidden: bool = False
    hidden_reason: str | None = None


class FeedPage(BaseModel):
    items: list[PostOut]
    next_cursor: str | None
