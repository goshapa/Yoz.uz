import uuid

from pydantic import BaseModel

from app.schemas.post import PostOut


class SearchUser(BaseModel):
    id: uuid.UUID
    display_name: str
    username: str
    avatar_url: str | None
    bio: str | None
    is_founder: bool = False


class SearchResponse(BaseModel):
    users: list[SearchUser]
    posts: list[PostOut]
    posts_next_cursor: str | None
