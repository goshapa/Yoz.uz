from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.post import Post
from app.models.report import Report, ReportTargetType
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.report import ReportCreate
from app.services.rate_limit import user_rate_limiter

router = APIRouter(prefix="/reports", tags=["reports"])


@router.post(
    "",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(user_rate_limiter("report", max_requests=20, window_seconds=60 * 60))],
)
async def create_report(
    payload: ReportCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if payload.target_type == ReportTargetType.post:
        if payload.target_post_id is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Не указана публикация")
        post = await db.get(Post, payload.target_post_id)
        if post is None or post.deleted_at is not None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Публикация не найдена")
    else:
        if payload.target_user_id is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Не указан профиль")
        target_user = await db.get(User, payload.target_user_id)
        if target_user is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")

    db.add(
        Report(
            reporter_id=current_user.id,
            target_type=payload.target_type,
            target_post_id=payload.target_post_id if payload.target_type == ReportTargetType.post else None,
            target_user_id=payload.target_user_id if payload.target_type == ReportTargetType.profile else None,
            reason=payload.reason,
            details=payload.details,
        )
    )
    await db.commit()
    return MessageResponse(message="Жалоба отправлена")
