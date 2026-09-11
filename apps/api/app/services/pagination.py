import base64
import uuid
from datetime import datetime

from fastapi import HTTPException, status

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 50


def encode_cursor(activity_at: datetime, post_id: uuid.UUID) -> str:
    raw = f"{activity_at.isoformat()}|{post_id}"
    return base64.urlsafe_b64encode(raw.encode("utf-8")).decode("ascii")


def decode_cursor(cursor: str) -> tuple[datetime, uuid.UUID]:
    try:
        raw = base64.urlsafe_b64decode(cursor.encode("ascii")).decode("utf-8")
        activity_at_str, post_id_str = raw.split("|", 1)
        return datetime.fromisoformat(activity_at_str), uuid.UUID(post_id_str)
    except (ValueError, UnicodeDecodeError) as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Некорректный курсор") from exc


def clamp_limit(limit: int) -> int:
    return max(1, min(limit, MAX_PAGE_SIZE))
