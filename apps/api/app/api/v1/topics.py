import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_current_user_optional
from app.db.session import get_db
from app.models.topic import Topic, TopicMembership
from app.models.user import User, UserRole
from app.schemas.topic import TopicMembershipOut, TopicOut, UniversityOption

router = APIRouter(prefix="/topics", tags=["topics"])


def _is_staff(user: User | None) -> bool:
    return user is not None and user.role != UserRole.user


@router.get("/directory", response_model=list[UniversityOption])
async def list_university_directory(db: AsyncSession = Depends(get_db)):
    """Публичный список вузов для выбора при регистрации/в настройках — доступен
    без входа в аккаунт, без счётчиков участников. Не путать с list_topics ниже,
    который отдаёт только «своё» сообщество для просмотра ленты/вступления."""
    result = await db.execute(select(Topic).where(Topic.is_active.is_(True)).order_by(Topic.sort_order))
    return list(result.scalars())


@router.get("", response_model=list[TopicOut])
async def list_topics(
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """Сообщества строго привязаны к вузу, указанному в профиле (university_topic_id):
    студент видит только своё сообщество, сотрудники (модератор/админ) — все, а тот,
    кто вуз не указал (включая анонимов и «школьников»), не видит ни одного —
    иначе, например, студент Вебстера мог бы сидеть в сообществе Вестминстера."""
    if _is_staff(current_user):
        topic_filter = Topic.is_active.is_(True)
    elif current_user is not None and current_user.university_topic_id is not None:
        topic_filter = Topic.id == current_user.university_topic_id
    else:
        return []

    counts_query = select(TopicMembership.topic_id, func.count().label("n")).group_by(TopicMembership.topic_id)
    counts = dict((await db.execute(counts_query)).all())

    member_of: set[uuid.UUID] = set()
    if current_user is not None:
        member_of = set(
            (
                await db.execute(
                    select(TopicMembership.topic_id).where(TopicMembership.user_id == current_user.id)
                )
            ).scalars()
        )

    result = await db.execute(select(Topic).where(topic_filter).order_by(Topic.sort_order))
    topics = list(result.scalars())

    return [
        TopicOut(
            id=t.id,
            slug=t.slug,
            name_ru=t.name_ru,
            name_uz=t.name_uz,
            name_en=t.name_en,
            members_count=counts.get(t.id, 0),
            is_member=t.id in member_of,
        )
        for t in topics
    ]


async def _get_topic(db: AsyncSession, topic_id: uuid.UUID) -> Topic:
    topic = await db.get(Topic, topic_id)
    if topic is None or not topic.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Сообщество не найдено")
    return topic


def _ensure_can_join(current_user: User, topic_id: uuid.UUID) -> None:
    if _is_staff(current_user):
        return
    if current_user.university_topic_id != topic_id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, detail="Можно вступать только в сообщество своего университета"
        )


async def _membership_out(db: AsyncSession, topic_id: uuid.UUID, is_member: bool) -> TopicMembershipOut:
    count = (
        await db.execute(
            select(func.count()).select_from(TopicMembership).where(TopicMembership.topic_id == topic_id)
        )
    ).scalar_one()
    return TopicMembershipOut(members_count=count, is_member=is_member)


@router.post("/{topic_id}/membership", response_model=TopicMembershipOut)
async def join_topic(
    topic_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_topic(db, topic_id)
    _ensure_can_join(current_user, topic_id)

    existing = await db.get(TopicMembership, {"topic_id": topic_id, "user_id": current_user.id})
    if existing is None:
        db.add(TopicMembership(topic_id=topic_id, user_id=current_user.id))
        await db.commit()

    return await _membership_out(db, topic_id, True)


@router.delete("/{topic_id}/membership", response_model=TopicMembershipOut)
async def leave_topic(
    topic_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_topic(db, topic_id)

    existing = await db.get(TopicMembership, {"topic_id": topic_id, "user_id": current_user.id})
    if existing is not None:
        await db.delete(existing)
        await db.commit()

    return await _membership_out(db, topic_id, False)
