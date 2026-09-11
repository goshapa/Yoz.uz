import logging
import smtplib
from email.headerregistry import Address
from email.message import EmailMessage

from app.core.config import get_settings

logger = logging.getLogger("yoz.email")


def send_email(to: str, subject: str, body: str) -> None:
    """Отправляет письмо через SMTP, если настроен; иначе пишет в лог (dev-режим)."""
    settings = get_settings()

    if not settings.smtp_host:
        logger.info("=== EMAIL (dev, SMTP не настроен) ===\nTo: %s\nSubject: %s\n\n%s", to, subject, body)
        return

    message = EmailMessage()
    message["From"] = Address(display_name="Yoz", addr_spec=settings.smtp_from)
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
        server.starttls()
        if settings.smtp_user:
            server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(message)


def send_verification_email(to: str, code: str) -> None:
    settings = get_settings()
    minutes = settings.email_verification_ttl_seconds // 60
    send_email(
        to=to,
        subject="Код подтверждения — Yoz",
        body=(
            f"Ваш код подтверждения: {code}\n\n"
            f"Введите его на сайте, чтобы подтвердить email. Код действует {minutes} минут."
        ),
    )


def send_password_reset_email(to: str, token: str) -> None:
    settings = get_settings()
    link = f"{settings.frontend_base_url}/reset-password?token={token}"
    send_email(
        to=to,
        subject="Восстановление пароля — Yoz",
        body=f"Чтобы задать новый пароль, перейдите по ссылке:\n{link}\n\nСсылка действует 1 час.",
    )
