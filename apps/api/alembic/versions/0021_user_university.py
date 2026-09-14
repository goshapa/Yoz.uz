"""users: add university_topic_id (gates access to university communities)

Revision ID: 0021_user_university
Revises: 0020_post_text_length
Create Date: 2026-09-14

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0021_user_university"
down_revision: Union[str, None] = "0020_post_text_length"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("university_topic_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index(
        op.f("ix_users_university_topic_id"), "users", ["university_topic_id"]
    )
    op.create_foreign_key(
        "fk_users_university_topic_id_topics",
        "users",
        "topics",
        ["university_topic_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_users_university_topic_id_topics", "users", type_="foreignkey")
    op.drop_index(op.f("ix_users_university_topic_id"), table_name="users")
    op.drop_column("users", "university_topic_id")
