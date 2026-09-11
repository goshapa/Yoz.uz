"""blocks and reports

Revision ID: 0004_blocks_and_reports
Revises: 0003_notifications
Create Date: 2026-09-09

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0004_blocks_and_reports"
down_revision: Union[str, None] = "0003_notifications"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

report_target_type = postgresql.ENUM("post", "profile", name="report_target_type")
report_reason = postgresql.ENUM(
    "spam", "abuse", "threats", "prohibited_content", "impersonation", "other", name="report_reason"
)
report_status = postgresql.ENUM("open", "resolved", name="report_status")


def upgrade() -> None:
    op.create_table(
        "blocks",
        sa.Column(
            "blocker_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
        ),
        sa.Column(
            "blocked_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_blocks_blocked_id", "blocks", ["blocked_id"])

    report_target_type.create(op.get_bind(), checkfirst=True)
    report_reason.create(op.get_bind(), checkfirst=True)
    report_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "reporter_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "target_type",
            postgresql.ENUM("post", "profile", name="report_target_type", create_type=False),
            nullable=False,
        ),
        sa.Column(
            "target_post_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("posts.id", ondelete="CASCADE"), nullable=True
        ),
        sa.Column(
            "target_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True
        ),
        sa.Column(
            "reason",
            postgresql.ENUM(
                "spam",
                "abuse",
                "threats",
                "prohibited_content",
                "impersonation",
                "other",
                name="report_reason",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("details", sa.String(length=500), nullable=True),
        sa.Column(
            "status",
            postgresql.ENUM("open", "resolved", name="report_status", create_type=False),
            nullable=False,
            server_default="open",
        ),
        sa.Column("resolution_note", sa.String(length=500), nullable=True),
        sa.Column(
            "resolved_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
        ),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_reports_reporter_id", "reports", ["reporter_id"])
    op.create_index("ix_reports_created_at", "reports", ["created_at"])


def downgrade() -> None:
    op.drop_table("reports")
    report_status.drop(op.get_bind(), checkfirst=True)
    report_reason.drop(op.get_bind(), checkfirst=True)
    report_target_type.drop(op.get_bind(), checkfirst=True)
    op.drop_table("blocks")
