import re
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator

from app.schemas.post import PostAuthor

USERNAME_RE = re.compile(r"^[a-zA-Z0-9_]{3,20}$")


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    display_name: str
    username: str
    avatar_url: str | None
    cover_url: str | None
    bio: str | None
    city: str | None
    website: str | None
    is_founder: bool = False
    created_at: datetime
    last_seen_at: datetime


class UserMe(UserPublic):
    email: str
    email_verified: bool
    role: str
    totp_enabled: bool


class ProfileOut(UserPublic):
    followers_count: int
    following_count: int
    is_following: bool
    is_self: bool
    is_blocked_by_viewer: bool = False


class FollowListPage(BaseModel):
    items: list[PostAuthor]
    next_cursor: str | None


class DeleteAccountRequest(BaseModel):
    password: str


class SignupRequest(BaseModel):
    display_name: str
    username: str
    email: EmailStr
    password: str

    @field_validator("display_name")
    @classmethod
    def validate_display_name(cls, v: str) -> str:
        v = v.strip()
        if not (1 <= len(v) <= 50):
            raise ValueError("Отображаемое имя должно быть от 1 до 50 символов")
        return v

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        if not USERNAME_RE.match(v):
            raise ValueError(
                "Username: 3-20 символов, латинские буквы, цифры и нижнее подчёркивание"
            )
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Пароль должен быть не короче 8 символов")
        return v
