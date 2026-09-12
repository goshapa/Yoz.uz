from fastapi import APIRouter, Depends
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.db.session import get_db
from app.models.push_subscription import PushSubscription
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.push import PushStatusOut, PushSubscriptionIn, VapidKeyOut

router = APIRouter(prefix="/push", tags=["push"])
settings = get_settings()


@router.get("/vapid-public-key", response_model=VapidKeyOut)
async def vapid_public_key():
    return VapidKeyOut(public_key=settings.vapid_public_key)


@router.post("/subscribe", response_model=MessageResponse)
async def subscribe(
    payload: PushSubscriptionIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # На случай, если та же подписка (endpoint) раньше принадлежала другому
    # аккаунту на этом же устройстве/браузере — переносим её текущему пользователю.
    stmt = (
        pg_insert(PushSubscription)
        .values(
            user_id=current_user.id,
            endpoint=payload.endpoint,
            p256dh=payload.keys.p256dh,
            auth=payload.keys.auth,
        )
        .on_conflict_do_update(
            index_elements=[PushSubscription.endpoint],
            set_={"user_id": current_user.id, "p256dh": payload.keys.p256dh, "auth": payload.keys.auth},
        )
    )
    await db.execute(stmt)
    await db.commit()
    return MessageResponse(message="Подписка на уведомления сохранена")


@router.delete("/subscribe", response_model=MessageResponse)
async def unsubscribe(
    endpoint: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        delete(PushSubscription).where(
            PushSubscription.user_id == current_user.id, PushSubscription.endpoint == endpoint
        )
    )
    await db.commit()
    return MessageResponse(message="Подписка на уведомления отключена")


@router.get("/status", response_model=PushStatusOut)
async def push_status(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    count = len(
        (await db.execute(select(PushSubscription).where(PushSubscription.user_id == current_user.id))).all()
    )
    return PushStatusOut(subscribed=count > 0)
