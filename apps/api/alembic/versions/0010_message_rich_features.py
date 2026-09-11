"""direct messages: reply, edit, delete, reactions, attachments

Revision ID: 0010_message_rich_features
Revises: 0009_direct_messages
Create Date: 2026-09-10

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0010_message_rich_features"
down_revision: Union[str, None] = "0009_direct_messages"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

attachment_type = postgresql.ENUM("image", "video", name="direct_message_attachment_type")


def upgrade() -> None:
    op.add_column("conversations", sa.Column("user_a_cleared_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("conversations", sa.Column("user_b_cleared_at", sa.DateTime(timezone=True), nullable=True))

    op.alter_column("direct_messages", "text", existing_type=sa.String(length=2000), nullable=True)
    op.add_column(
        "direct_messages",
        sa.Column(
            "reply_to_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("direct_messages.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column("direct_messages", sa.Column("attachment_url", sa.String(length=500), nullable=True))
    op.add_column("direct_messages", sa.Column("attachment_thumbnail_url", sa.String(length=500), nullable=True))
    attachment_type.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "direct_messages",
        sa.Column(
            "attachment_type",
            postgresql.ENUM("image", "video", name="direct_message_attachment_type", create_type=False),
            nullable=True,
        ),
    )
    op.add_column("direct_messages", sa.Column("edited_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("direct_messages", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        "direct_message_reactions",
        sa.Column(
            "message_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("direct_messages.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
        ),
        sa.Column("emoji", sa.String(length=8), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("direct_message_reactions")
    op.drop_column("direct_messages", "deleted_at")
    op.drop_column("direct_messages", "edited_at")
    op.drop_column("direct_messages", "attachment_type")
    attachment_type.drop(op.get_bind(), checkfirst=True)
    op.drop_column("direct_messages", "attachment_thumbnail_url")
    op.drop_column("direct_messages", "attachment_url")
    op.drop_column("direct_messages", "reply_to_id")
    op.alter_column("direct_messages", "text", existing_type=sa.String(length=2000), nullable=False)
    op.drop_column("conversations", "user_b_cleared_at")
    op.drop_column("conversations", "user_a_cleared_at")
