"""admin: moderation log, user suspension reason, TOTP 2FA fields

Revision ID: 0005_admin_and_2fa
Revises: 0004_blocks_and_reports
Create Date: 2026-09-09

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0005_admin_and_2fa"
down_revision: Union[str, None] = "0004_blocks_and_reports"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

moderation_action = postgresql.ENUM(
    "hide_post",
    "unhide_post",
    "suspend_user",
    "unsuspend_user",
    "assign_role",
    "resolve_report",
    "create_topic",
    "update_topic",
    name="moderation_action",
)
moderation_target_type = postgresql.ENUM("post", "user", "report", "topic", name="moderation_target_type")


def upgrade() -> None:
    op.add_column("users", sa.Column("suspension_reason", sa.String(length=500), nullable=True))
    op.add_column("users", sa.Column("totp_secret", sa.String(length=64), nullable=True))
    op.add_column(
        "users", sa.Column("totp_enabled", sa.Boolean(), nullable=False, server_default=sa.false())
    )

    moderation_action.create(op.get_bind(), checkfirst=True)
    moderation_target_type.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "moderation_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "actor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
        ),
        sa.Column(
            "action", postgresql.ENUM(
                "hide_post",
                "unhide_post",
                "suspend_user",
                "unsuspend_user",
                "assign_role",
                "resolve_report",
                "create_topic",
                "update_topic",
                name="moderation_action",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column(
            "target_type",
            postgresql.ENUM("post", "user", "report", "topic", name="moderation_target_type", create_type=False),
            nullable=False,
        ),
        sa.Column("target_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reason", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_moderation_log_created_at", "moderation_log", ["created_at"])


def downgrade() -> None:
    op.drop_table("moderation_log")
    moderation_target_type.drop(op.get_bind(), checkfirst=True)
    moderation_action.drop(op.get_bind(), checkfirst=True)

    op.drop_column("users", "totp_enabled")
    op.drop_column("users", "totp_secret")
    op.drop_column("users", "suspension_reason")
