"""topics: memberships (communities)

Revision ID: 0016_topic_memberships
Revises: 0015_user_last_seen
Create Date: 2026-09-12

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0016_topic_memberships"
down_revision: Union[str, None] = "0015_user_last_seen"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "topic_memberships",
        sa.Column(
            "topic_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("topics.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_topic_memberships_user_id", "topic_memberships", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_topic_memberships_user_id", table_name="topic_memberships")
    op.drop_table("topic_memberships")
