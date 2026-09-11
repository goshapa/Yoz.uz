"""group chats: groups, members, messages

Revision ID: 0013_group_chats
Revises: 0012_forwarded_messages
Create Date: 2026-09-11

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0013_group_chats"
down_revision: Union[str, None] = "0012_forwarded_messages"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

group_role = postgresql.ENUM("owner", "member", name="group_member_role")
group_attachment_type = postgresql.ENUM("image", "video", name="group_message_attachment_type")


def upgrade() -> None:
    op.create_table(
        "group_chats",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(length=100), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column("avatar_url", sa.String(length=500), nullable=True),
        sa.Column(
            "created_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("last_message_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_group_chats_last_message_at", "group_chats", ["last_message_at"])

    group_role.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "group_members",
        sa.Column(
            "group_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("group_chats.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "role", postgresql.ENUM("owner", "member", name="group_member_role", create_type=False),
            nullable=False, server_default="member",
        ),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("cleared_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_read_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_group_members_user_id", "group_members", ["user_id"])

    group_attachment_type.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "group_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "group_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("group_chats.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "sender_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("text", sa.String(length=2000), nullable=True),
        sa.Column("attachment_url", sa.String(length=500), nullable=True),
        sa.Column("attachment_thumbnail_url", sa.String(length=500), nullable=True),
        sa.Column(
            "attachment_type",
            postgresql.ENUM("image", "video", name="group_message_attachment_type", create_type=False),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("edited_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_group_messages_group_id", "group_messages", ["group_id"])
    op.create_index("ix_group_messages_created_at", "group_messages", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_group_messages_created_at", table_name="group_messages")
    op.drop_index("ix_group_messages_group_id", table_name="group_messages")
    op.drop_table("group_messages")
    group_attachment_type.drop(op.get_bind(), checkfirst=True)

    op.drop_index("ix_group_members_user_id", table_name="group_members")
    op.drop_table("group_members")
    group_role.drop(op.get_bind(), checkfirst=True)

    op.drop_index("ix_group_chats_last_message_at", table_name="group_chats")
    op.drop_table("group_chats")
