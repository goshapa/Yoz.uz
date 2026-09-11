"""posts: add video_url

Revision ID: 0011_post_video
Revises: 0010_message_rich_features
Create Date: 2026-09-10

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0011_post_video"
down_revision: Union[str, None] = "0010_message_rich_features"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("posts", sa.Column("video_url", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("posts", "video_url")
