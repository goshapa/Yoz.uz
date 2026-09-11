"""email verification: track attempts for OTP-code brute-force protection

Revision ID: 0006_email_code_attempts
Revises: 0005_admin_and_2fa
Create Date: 2026-09-09

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0006_email_code_attempts"
down_revision: Union[str, None] = "0005_admin_and_2fa"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "email_verification_tokens",
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
    )

    # Код теперь 6 цифр (10^6 вариантов) вместо длинного случайного токена —
    # уникальность между разными пользователями больше не гарантирована.
    # Обычный (не уникальный) индекс на token_hash уже создан в 0001_initial.
    op.drop_constraint("uq_email_verification_tokens_token_hash", "email_verification_tokens", type_="unique")


def downgrade() -> None:
    op.create_unique_constraint(
        "uq_email_verification_tokens_token_hash", "email_verification_tokens", ["token_hash"]
    )
    op.drop_column("email_verification_tokens", "attempts")
