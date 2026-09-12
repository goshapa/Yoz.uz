import asyncio
import json
import logging
import uuid

from pywebpush import WebPushException, webpush
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.push_subscription import PushSubscription

settings = get_settings()
logger = logging.getLogger("yoz.push")


def _send_one(sub: PushSubscription, payload: str) -> int | None:
    """Отправляет один пуш синхронно (pywebpush использует requests) — вызывается
    через asyncio.to_thread, чтобы не блокировать event loop. Возвращает HTTP-код
    ошибки, если подписка мертва (404/410 — её пора удалить), иначе None."""
    try:
        webpush(
            subscription_info={
                "endpoint": sub.endpoint,
                "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
            },
            data=payload,
            vapid_private_key=settings.vapid_private_key,
            vapid_claims={"sub": settings.vapid_subject},
        )
    except WebPushException as exc:
        status_code = exc.response.status_code if exc.response is not None else None
        if status_code in (404, 410):
            return status_code
    except Exception:
        # Одна битая/повреждённая подписка (например, обрезанные ключи) не должна
        # ронять всю отправку уведомления — pywebpush может кинуть не только
        # WebPushException (например, при разборе некорректных base64-ключей).
        logger.warning("push send failed for subscription %s", sub.id, exc_info=True)
    return None


async def send_push_to_user(db: AsyncSession, user_id: uuid.UUID, title: str, body: str, url: str = "/") -> None:
    if not settings.vapid_private_key:
        return

    subs = list((await db.execute(select(PushSubscription).where(PushSubscription.user_id == user_id))).scalars())
    if not subs:
        return

    payload = json.dumps({"title": title, "body": body, "url": url})
    dead_ids = []
    for sub in subs:
        result = await asyncio.to_thread(_send_one, sub, payload)
        if result is not None:
            dead_ids.append(sub.id)

    if dead_ids:
        for sub in subs:
            if sub.id in dead_ids:
                await db.delete(sub)
        await db.commit()
