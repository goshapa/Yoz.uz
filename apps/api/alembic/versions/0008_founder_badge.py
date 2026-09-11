"""users: add founder badge flag

Revision ID: 0008_founder_badge
Revises: 0007_topic_name_en
Create Date: 2026-09-10

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0008_founder_badge"
down_revision: Union[str, None] = "0007_topic_name_en"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users", sa.Column("is_founder", sa.Boolean(), nullable=False, server_default=sa.false())
    )


def downgrade() -> None:
    op.drop_column("users", "is_founder")
