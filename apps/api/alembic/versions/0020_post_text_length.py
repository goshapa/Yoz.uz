"""posts: raise text length limit to 5000

Revision ID: 0020_post_text_length
Revises: 0019_push_subscriptions
Create Date: 2026-09-12

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0020_post_text_length"
down_revision: Union[str, None] = "0019_push_subscriptions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("posts", "text", type_=sa.String(length=5000))


def downgrade() -> None:
    op.alter_column("posts", "text", type_=sa.String(length=500))
