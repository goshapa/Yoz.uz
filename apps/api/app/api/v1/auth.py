import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.security import generate_otp_code, generate_token, hash_password, hash_token, verify_password
from app.db.session import get_db
from app.models.session import Session
from app.models.tokens import EmailVerificationToken, PasswordResetToken
from app.models.topic import Topic
from app.models.user import User, UserRole
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    LoginResult,
    MessageResponse,
    ResendVerificationRequest,
    ResetPasswordRequest,
    TwoFactorConfirmRequest,
    TwoFactorDisableRequest,
    TwoFactorSetupOut,
    TwoFactorVerifyLoginRequest,
    VerifyEmailRequest,
)
from app.schemas.user import SignupRequest, UserMe
from app.services.email import send_password_reset_email, send_verification_email
from app.services.rate_limit import rate_limiter
from app.services.two_factor import (
    create_login_challenge,
    generate_secret,
    provisioning_uri,
    resolve_login_challenge,
    verify_code,
)


router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


def _suspended_detail(user: User) -> str:
    reason = user.suspension_reason or "не указана"
    return f"Аккаунт ограничен. Причина: {reason}. Для обращения в поддержку: {settings.support_contact}"


def _set_session_cookie(response: Response, request: Request, raw_token: str) -> None:
    # Фронтенд и API почти всегда на одном хосте (разные порты) — там достаточно
    # SameSite=Lax. Но когда запрос пришёл через HTTPS (например, публичный туннель
    # для показа сайта извне, где фронтенд и API на разных доменах), браузер не
    # пришлёт Lax-cookie в кросс-доменном запросе — переключаемся на None+Secure,
    # что разрешено только вместе с Secure.
    #
    # На проде api стоит за Caddy и порт наружу не торчит (см. docker-compose.prod.yml),
    # так что Caddy — единственный, кто может достучаться до uvicorn напрямую. Caddy
    # терминирует TLS и проксирует запрос по HTTP внутри docker-сети, поэтому
    # request.url.scheme здесь всегда "http", даже когда снаружи HTTPS — заголовку
    # X-Forwarded-Proto от Caddy в этой топологии можно доверять.
    forwarded_proto = request.headers.get("x-forwarded-proto", "").split(",")[0].strip()
    is_https = forwarded_proto == "https" or request.url.scheme == "https"
    response.set_cookie(
        key=settings.session_cookie_name,
        value=raw_token,
        max_age=settings.session_ttl_seconds,
        httponly=True,
        secure=is_https,
        samesite="none" if is_https else "lax",
        path="/",
    )


async def _create_session(db: AsyncSession, request: Request, response: Response, user: User) -> None:
    raw_token = generate_token()
    session = Session(
        user_id=user.id,
        token_hash=hash_token(raw_token),
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
        expires_at=datetime.now(timezone.utc) + timedelta(seconds=settings.session_ttl_seconds),
    )
    db.add(session)
    await db.commit()
    _set_session_cookie(response, request, raw_token)


@router.post(
    "/signup",
    response_model=UserMe,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limiter("signup", max_requests=5, window_seconds=60 * 60))],
)
async def signup(payload: SignupRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(
        select(User).where(
            or_(
                func.lower(User.username) == payload.username.lower(),
                func.lower(User.email) == payload.email.lower(),
            )
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Пользователь с таким username или email уже существует",
        )

    if payload.university_topic_id is not None:
        topic = await db.get(Topic, payload.university_topic_id)
        if topic is None or not topic.is_active:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Недопустимый университет")

    user = User(
        display_name=payload.display_name,
        username=payload.username,
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        university_topic_id=payload.university_topic_id,
    )
    db.add(user)
    await db.flush()

    code = generate_otp_code()
    verification = EmailVerificationToken(
        user_id=user.id,
        token_hash=hash_token(code),
        expires_at=datetime.now(timezone.utc)
        + timedelta(seconds=settings.email_verification_ttl_seconds),
    )
    db.add(verification)
    await db.commit()
    await db.refresh(user)

    send_verification_email(user.email, code)

    return user


async def _active_verification(db: AsyncSession, user_id: uuid.UUID) -> EmailVerificationToken | None:
    """Последний неиспользованный, ещё не истёкший код подтверждения пользователя."""
    result = await db.execute(
        select(EmailVerificationToken)
        .where(EmailVerificationToken.user_id == user_id, EmailVerificationToken.used_at.is_(None))
        .order_by(EmailVerificationToken.created_at.desc())
    )
    verification = result.scalars().first()
    if verification is None:
        return None
    if verification.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        return None
    return verification


@router.post(
    "/verify-email",
    response_model=MessageResponse,
    dependencies=[Depends(rate_limiter("verify-email", max_requests=20, window_seconds=60 * 15))],
)
async def verify_email(payload: VerifyEmailRequest, db: AsyncSession = Depends(get_db)):
    user_result = await db.execute(select(User).where(func.lower(User.email) == payload.email.lower()))
    user = user_result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Неверный код")

    if user.email_verified:
        return MessageResponse(message="Email подтверждён")

    verification = await _active_verification(db, user.id)
    if verification is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Код устарел, запросите новый"
        )

    if verification.attempts >= settings.email_verification_max_attempts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Слишком много попыток, запросите новый код"
        )

    if verification.token_hash != hash_token(payload.code):
        verification.attempts += 1
        await db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Неверный код")

    user.email_verified = True
    verification.used_at = datetime.now(timezone.utc)
    await db.commit()

    return MessageResponse(message="Email подтверждён")


@router.post(
    "/resend-verification",
    response_model=MessageResponse,
    dependencies=[Depends(rate_limiter("resend-verification", max_requests=3, window_seconds=60 * 15))],
)
async def resend_verification(payload: ResendVerificationRequest, db: AsyncSession = Depends(get_db)):
    user_result = await db.execute(select(User).where(func.lower(User.email) == payload.email.lower()))
    user = user_result.scalar_one_or_none()

    # Не раскрываем, существует ли email — ответ одинаковый в обоих случаях.
    if user is not None and not user.email_verified:
        code = generate_otp_code()
        verification = EmailVerificationToken(
            user_id=user.id,
            token_hash=hash_token(code),
            expires_at=datetime.now(timezone.utc)
            + timedelta(seconds=settings.email_verification_ttl_seconds),
        )
        db.add(verification)
        await db.commit()
        send_verification_email(user.email, code)

    return MessageResponse(message="Если email зарегистрирован и не подтверждён, код отправлен")


@router.post(
    "/login",
    response_model=LoginResult,
    dependencies=[Depends(rate_limiter("login", max_requests=10, window_seconds=60 * 15))],
)
async def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(func.lower(User.email) == payload.email.lower()))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный email или пароль"
        )

    if user.is_suspended:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=_suspended_detail(user))

    if not user.email_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="EMAIL_NOT_VERIFIED")

    if user.role != UserRole.user and user.totp_enabled:
        challenge_token = await create_login_challenge(user.id)
        return LoginResult(requires_2fa=True, challenge_token=challenge_token)

    await _create_session(db, request, response, user)
    return LoginResult(user=user)


@router.post(
    "/2fa/verify-login",
    response_model=UserMe,
    dependencies=[Depends(rate_limiter("2fa-verify", max_requests=10, window_seconds=60 * 15))],
)
async def verify_login_2fa(
    payload: TwoFactorVerifyLoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    user_id = await resolve_login_challenge(payload.challenge_token)
    if user_id is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Сессия входа истекла, войдите заново")

    user = await db.get(User, user_id)
    if user is None or not user.totp_enabled or not user.totp_secret:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Двухфакторная аутентификация не настроена")

    if not verify_code(user.totp_secret, payload.code):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Неверный код")

    if user.is_suspended:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail=_suspended_detail(user))

    await _create_session(db, request, response, user)
    return user


@router.post("/2fa/setup", response_model=TwoFactorSetupOut)
async def setup_2fa(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role == UserRole.user:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="2FA доступна только модераторам и администраторам")

    secret = generate_secret()
    current_user.totp_secret = secret
    current_user.totp_enabled = False
    await db.commit()

    return TwoFactorSetupOut(secret=secret, provisioning_uri=provisioning_uri(secret, current_user.email))


@router.post("/2fa/confirm", response_model=MessageResponse)
async def confirm_2fa(
    payload: TwoFactorConfirmRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.totp_secret:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Сначала запросите /2fa/setup")
    if not verify_code(current_user.totp_secret, payload.code):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Неверный код")

    current_user.totp_enabled = True
    await db.commit()
    return MessageResponse(message="Двухфакторная аутентификация включена")


@router.post("/2fa/disable", response_model=MessageResponse)
async def disable_2fa(
    payload: TwoFactorDisableRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(payload.password, current_user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Неверный пароль")

    current_user.totp_enabled = False
    current_user.totp_secret = None
    await db.commit()
    return MessageResponse(message="Двухфакторная аутентификация отключена")


@router.post("/logout", response_model=MessageResponse)
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    raw_token = request.cookies.get(settings.session_cookie_name)
    if raw_token:
        token_hash = hash_token(raw_token)
        result = await db.execute(select(Session).where(Session.token_hash == token_hash))
        session = result.scalar_one_or_none()
        if session is not None:
            await db.delete(session)
            await db.commit()

    response.delete_cookie(settings.session_cookie_name, path="/")
    return MessageResponse(message="Вы вышли из аккаунта")


@router.post("/logout-all", response_model=MessageResponse)
async def logout_all(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    raw_token = request.cookies.get(settings.session_cookie_name)
    if not raw_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Требуется вход")

    token_hash = hash_token(raw_token)
    current = await db.execute(select(Session).where(Session.token_hash == token_hash))
    current_session = current.scalar_one_or_none()
    if current_session is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Требуется вход")

    others = await db.execute(
        select(Session).where(
            Session.user_id == current_session.user_id, Session.id != current_session.id
        )
    )
    for session in others.scalars():
        await db.delete(session)
    await db.commit()

    return MessageResponse(message="Остальные сеансы завершены")


@router.post(
    "/forgot-password",
    response_model=MessageResponse,
    dependencies=[Depends(rate_limiter("forgot-password", max_requests=5, window_seconds=60 * 60))],
)
async def forgot_password(payload: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(func.lower(User.email) == payload.email.lower()))
    user = result.scalar_one_or_none()

    # Не раскрываем, существует ли email — ответ одинаковый в обоих случаях.
    if user is not None:
        raw_token = generate_token()
        reset = PasswordResetToken(
            user_id=user.id,
            token_hash=hash_token(raw_token),
            expires_at=datetime.now(timezone.utc)
            + timedelta(seconds=settings.password_reset_ttl_seconds),
        )
        db.add(reset)
        await db.commit()
        send_password_reset_email(user.email, raw_token)

    return MessageResponse(
        message="Если такой email зарегистрирован, на него отправлена ссылка для восстановления"
    )


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(payload: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    if len(payload.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Пароль должен быть не короче 8 символов"
        )

    token_hash = hash_token(payload.token)
    result = await db.execute(
        select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash)
    )
    reset = result.scalar_one_or_none()

    if reset is None or reset.used_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Неверная ссылка")

    if reset.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ссылка устарела")

    user_result = await db.execute(select(User).where(User.id == reset.user_id))
    user = user_result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Неверная ссылка")

    user.password_hash = hash_password(payload.new_password)
    reset.used_at = datetime.now(timezone.utc)

    # Восстановление пароля обнуляет все активные сеансы.
    existing_sessions = await db.execute(select(Session).where(Session.user_id == user.id))
    for session in existing_sessions.scalars():
        await db.delete(session)

    await db.commit()

    return MessageResponse(message="Пароль обновлён, войдите заново")
