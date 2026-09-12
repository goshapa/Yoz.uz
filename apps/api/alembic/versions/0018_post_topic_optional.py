"""posts: topic_id becomes optional

Revision ID: 0018_post_topic_optional
Revises: 0017_post_community_only
Create Date: 2026-09-12

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0018_post_topic_optional"
down_revision: Union[str, None] = "0017_post_community_only"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("posts", "topic_id", nullable=True)


def downgrade() -> None:
    op.alter_column("posts", "topic_id", nullable=False)
