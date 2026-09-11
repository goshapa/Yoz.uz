"""direct messages: forwarded_from_id

Revision ID: 0012_forwarded_messages
Revises: 0011_post_video
Create Date: 2026-09-11

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0012_forwarded_messages"
down_revision: Union[str, None] = "0011_post_video"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "direct_messages",
        sa.Column(
            "forwarded_from_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("direct_messages", "forwarded_from_id")
