import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_admin, require_staff
from app.db.session import get_db
from app.models.moderation_log import ModerationAction, ModerationLogEntry, ModerationTargetType
from app.models.post import Post
from app.models.report import Report, ReportStatus
from app.models.topic import Topic
from app.models.user import User, UserRole
from app.schemas.admin import (
    AdminReportOut,
    AdminReportPage,
    AdminTopicOut,
    AdminUserOut,
    AdminUserPage,
    AssignRoleRequest,
    HidePostRequest,
    ModerationLogOut,
    ModerationLogPage,
    ResolveReportRequest,
    StatsOut,
    SuspendUserRequest,
    TopicCreate,
    TopicUpdate,
)
from app.schemas.auth import MessageResponse
from app.services.moderation import log_action
from app.services.pagination import clamp_limit, decode_cursor, encode_cursor
from app.services.post_serializer import to_author

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/reports", response_model=AdminReportPage)
async def list_reports(
    status_filter: ReportStatus | None = None,
    cursor: str | None = None,
    limit: int = 20,
    _staff: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    limit = clamp_limit(limit)
    query = select(Report)
    if status_filter is not None:
        query = query.where(Report.status == status_filter)
    if cursor:
        cursor_created_at, cursor_id = decode_cursor(cursor)
        query = query.where(tuple_(Report.created_at, Report.id) < (cursor_created_at, cursor_id))
    query = query.order_by(Report.created_at.desc(), Report.id.desc()).limit(limit + 1)

    rows = list((await db.execute(query)).scalars())
    has_more = len(rows) > limit
    rows = rows[:limit]

    reporter_ids = {r.reporter_id for r in rows}
    reporters = {u.id: u for u in (await db.execute(select(User).where(User.id.in_(reporter_ids)))).scalars()}

    items = [
        AdminReportOut(
            id=r.id,
            reporter=to_author(reporters.get(r.reporter_id)),
            target_type=r.target_type.value,
            target_post_id=r.target_post_id,
            target_user_id=r.target_user_id,
            reason=r.reason.value,
            details=r.details,
            status=r.status.value,
            resolution_note=r.resolution_note,
            created_at=r.created_at,
            resolved_at=r.resolved_at,
        )
        for r in rows
    ]
    next_cursor = encode_cursor(rows[-1].created_at, rows[-1].id) if has_more and rows else None
    return AdminReportPage(items=items, next_cursor=next_cursor)


@router.post("/reports/{report_id}/resolve", response_model=MessageResponse)
async def resolve_report(
    report_id: uuid.UUID,
    payload: ResolveReportRequest,
    staff: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    report = await db.get(Report, report_id)
    if report is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Жалоба не найдена")

    report.status = payload.status
    report.resolution_note = payload.resolution_note
    report.resolved_by = staff.id
    report.resolved_at = datetime.now(timezone.utc)
    await db.commit()

    await log_action(
        db, staff.id, ModerationAction.resolve_report, ModerationTargetType.report, report.id, payload.resolution_note
    )
    return MessageResponse(message="Жалоба обработана")


@router.post("/posts/{post_id}/hide", response_model=MessageResponse)
async def hide_post(
    post_id: uuid.UUID,
    payload: HidePostRequest,
    staff: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    post = await db.get(Post, post_id)
    if post is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Публикация не найдена")

    post.is_hidden = True
    post.hidden_reason = payload.reason
    post.hidden_by = staff.id
    post.hidden_at = datetime.now(timezone.utc)
    await db.commit()

    await log_action(db, staff.id, ModerationAction.hide_post, ModerationTargetType.post, post.id, payload.reason)
    return MessageResponse(message="Публикация скрыта")


@router.post("/posts/{post_id}/unhide", response_model=MessageResponse)
async def unhide_post(
    post_id: uuid.UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    post = await db.get(Post, post_id)
    if post is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Публикация не найдена")

    post.is_hidden = False
    post.hidden_reason = None
    post.hidden_by = None
    post.hidden_at = None
    await db.commit()

    await log_action(db, admin.id, ModerationAction.unhide_post, ModerationTargetType.post, post.id)
    return MessageResponse(message="Публикация восстановлена")


@router.post("/users/{user_id}/suspend", response_model=MessageResponse)
async def suspend_user(
    user_id: uuid.UUID,
    payload: SuspendUserRequest,
    staff: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    target = await db.get(User, user_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")
    if target.role != UserRole.user and staff.role != UserRole.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Недостаточно прав для ограничения этого аккаунта")

    target.is_suspended = True
    target.suspension_reason = payload.reason
    await db.commit()

    await log_action(db, staff.id, ModerationAction.suspend_user, ModerationTargetType.user, target.id, payload.reason)
    return MessageResponse(message="Аккаунт ограничен")


@router.post("/users/{user_id}/unsuspend", response_model=MessageResponse)
async def unsuspend_user(
    user_id: uuid.UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    target = await db.get(User, user_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")

    target.is_suspended = False
    target.suspension_reason = None
    await db.commit()

    await log_action(db, admin.id, ModerationAction.unsuspend_user, ModerationTargetType.user, target.id)
    return MessageResponse(message="Доступ восстановлен")


@router.post("/users/{user_id}/role", response_model=MessageResponse)
async def assign_role(
    user_id: uuid.UUID,
    payload: AssignRoleRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    target = await db.get(User, user_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")

    target.role = payload.role
    await db.commit()

    await log_action(
        db, admin.id, ModerationAction.assign_role, ModerationTargetType.user, target.id, f"role={payload.role.value}"
    )
    return MessageResponse(message="Роль обновлена")


@router.get("/users", response_model=AdminUserPage)
async def list_users(
    q: str | None = None,
    cursor: str | None = None,
    limit: int = 30,
    _staff: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    limit = clamp_limit(limit)
    query = select(User)
    query_text = (q or "").strip()
    if query_text:
        query = query.where(
            or_(
                User.display_name.ilike(f"%{query_text}%"),
                User.username.ilike(f"%{query_text}%"),
                User.email.ilike(f"%{query_text}%"),
            )
        )
    if cursor:
        cursor_created_at, cursor_id = decode_cursor(cursor)
        query = query.where(tuple_(User.created_at, User.id) < (cursor_created_at, cursor_id))
    query = query.order_by(User.created_at.desc(), User.id.desc()).limit(limit + 1)

    rows = list((await db.execute(query)).scalars())
    has_more = len(rows) > limit
    rows = rows[:limit]

    items = [
        AdminUserOut(
            id=u.id,
            display_name=u.display_name,
            username=u.username,
            email=u.email,
            avatar_url=u.avatar_url,
            role=u.role.value,
            is_suspended=u.is_suspended,
            suspension_reason=u.suspension_reason,
            email_verified=u.email_verified,
            is_founder=u.is_founder,
            created_at=u.created_at,
            last_seen_at=u.last_seen_at,
        )
        for u in rows
    ]
    next_cursor = encode_cursor(rows[-1].created_at, rows[-1].id) if has_more and rows else None
    return AdminUserPage(items=items, next_cursor=next_cursor)


@router.get("/topics", response_model=list[AdminTopicOut])
async def list_all_topics(
    _staff: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Topic).order_by(Topic.sort_order))
    return list(result.scalars())


@router.post("/topics", response_model=AdminTopicOut, status_code=status.HTTP_201_CREATED)
async def create_topic(
    payload: TopicCreate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(Topic).where(Topic.slug == payload.slug))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Тема с таким slug уже существует")

    topic = Topic(
        slug=payload.slug,
        name_ru=payload.name_ru,
        name_uz=payload.name_uz,
        name_en=payload.name_en,
        sort_order=payload.sort_order,
    )
    db.add(topic)
    await db.flush()
    topic_id = topic.id
    await db.commit()

    await log_action(db, admin.id, ModerationAction.create_topic, ModerationTargetType.topic, topic_id)
    await db.refresh(topic)
    return topic


@router.patch("/topics/{topic_id}", response_model=AdminTopicOut)
async def update_topic(
    topic_id: uuid.UUID,
    payload: TopicUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    topic = await db.get(Topic, topic_id)
    if topic is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Тема не найдена")

    if payload.name_ru is not None:
        topic.name_ru = payload.name_ru
    if payload.name_uz is not None:
        topic.name_uz = payload.name_uz
    if payload.name_en is not None:
        topic.name_en = payload.name_en
    if payload.is_active is not None:
        topic.is_active = payload.is_active
    if payload.sort_order is not None:
        topic.sort_order = payload.sort_order

    await db.commit()
    await log_action(db, admin.id, ModerationAction.update_topic, ModerationTargetType.topic, topic.id)
    await db.refresh(topic)
    return topic


@router.get("/stats", response_model=StatsOut)
async def get_stats(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    users_count = (await db.execute(select(func.count()).select_from(User))).scalar_one()
    posts_count = (
        await db.execute(select(func.count()).select_from(Post).where(Post.deleted_at.is_(None)))
    ).scalar_one()
    open_reports_count = (
        await db.execute(select(func.count()).select_from(Report).where(Report.status == ReportStatus.open))
    ).scalar_one()
    suspended_users_count = (
        await db.execute(select(func.count()).select_from(User).where(User.is_suspended.is_(True)))
    ).scalar_one()

    return StatsOut(
        users_count=users_count,
        posts_count=posts_count,
        open_reports_count=open_reports_count,
        suspended_users_count=suspended_users_count,
    )


@router.get("/audit-log", response_model=ModerationLogPage)
async def audit_log(
    cursor: str | None = None,
    limit: int = 30,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    limit = clamp_limit(limit)
    query = select(ModerationLogEntry)
    if cursor:
        cursor_created_at, cursor_id = decode_cursor(cursor)
        query = query.where(
            tuple_(ModerationLogEntry.created_at, ModerationLogEntry.id) < (cursor_created_at, cursor_id)
        )
    query = query.order_by(ModerationLogEntry.created_at.desc(), ModerationLogEntry.id.desc()).limit(limit + 1)

    rows = list((await db.execute(query)).scalars())
    has_more = len(rows) > limit
    rows = rows[:limit]

    actor_ids = {r.actor_id for r in rows if r.actor_id is not None}
    actors = {u.id: u for u in (await db.execute(select(User).where(User.id.in_(actor_ids)))).scalars()}

    items = [
        ModerationLogOut(
            id=r.id,
            actor=to_author(actors.get(r.actor_id)) if r.actor_id else None,
            action=r.action.value,
            target_type=r.target_type.value,
            target_id=r.target_id,
            reason=r.reason,
            created_at=r.created_at,
        )
        for r in rows
    ]
    next_cursor = encode_cursor(rows[-1].created_at, rows[-1].id) if has_more and rows else None
    return ModerationLogPage(items=items, next_cursor=next_cursor)
