"""users: last_seen_at

Revision ID: 0015_user_last_seen
Revises: 0014_group_reactions_and_forward
Create Date: 2026-09-12

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0015_user_last_seen"
down_revision: Union[str, None] = "0014_group_reactions_and_forward"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("last_seen_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("users", "last_seen_at")
