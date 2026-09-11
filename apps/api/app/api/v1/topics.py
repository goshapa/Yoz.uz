from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.topic import Topic
from app.schemas.topic import TopicOut

router = APIRouter(prefix="/topics", tags=["topics"])


@router.get("", response_model=list[TopicOut])
async def list_topics(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Topic).where(Topic.is_active.is_(True)).order_by(Topic.sort_order))
    return list(result.scalars())
