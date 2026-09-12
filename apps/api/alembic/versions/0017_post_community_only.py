"""posts: community_only flag

Revision ID: 0017_post_community_only
Revises: 0016_topic_memberships
Create Date: 2026-09-12

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0017_post_community_only"
down_revision: Union[str, None] = "0016_topic_memberships"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "posts",
        sa.Column("community_only", sa.Boolean(), server_default=sa.false(), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("posts", "community_only")
