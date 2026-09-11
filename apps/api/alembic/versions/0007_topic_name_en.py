"""topics: add English name

Revision ID: 0007_topic_name_en
Revises: 0006_email_code_attempts
Create Date: 2026-09-10

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0007_topic_name_en"
down_revision: Union[str, None] = "0006_email_code_attempts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NAME_EN_BY_SLUG = {
    "it-tech": "IT & technology",
    "education": "Education",
    "student-life": "Student life",
    "work-business": "Work & business",
    "news-society": "News & society",
    "sport": "Sport",
    "entertainment": "Entertainment & memes",
}


def upgrade() -> None:
    op.add_column("topics", sa.Column("name_en", sa.String(length=100), nullable=True))

    topics = sa.table("topics", sa.column("slug", sa.String), sa.column("name_en", sa.String))
    for slug, name_en in NAME_EN_BY_SLUG.items():
        op.execute(topics.update().where(topics.c.slug == slug).values(name_en=name_en))
    # Темы, созданные вручную после 0002 и отсутствующие в списке выше, получают
    # английское имя-заглушку, чтобы колонку можно было сделать обязательной.
    op.execute(topics.update().where(topics.c.name_en.is_(None)).values(name_en="Other"))

    op.alter_column("topics", "name_en", nullable=False)


def downgrade() -> None:
    op.drop_column("topics", "name_en")
