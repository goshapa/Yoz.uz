"""group chats: reactions + forwarded_from

Revision ID: 0014_group_reactions_and_forward
Revises: 0013_group_chats
Create Date: 2026-09-11

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0014_group_reactions_and_forward"
down_revision: Union[str, None] = "0013_group_chats"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "group_messages",
        sa.Column(
            "forwarded_from_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )

    op.create_table(
        "group_message_reactions",
        sa.Column(
            "message_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("group_messages.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("emoji", sa.String(length=8), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("group_message_reactions")
    op.drop_column("group_messages", "forwarded_from_id")
