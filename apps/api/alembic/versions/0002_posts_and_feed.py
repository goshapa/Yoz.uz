"""posts, feed and interactions: topics, posts, images, hashtags, mentions, likes, reposts, bookmarks, follows

Revision ID: 0002_posts_and_feed
Revises: 0001_initial
Create Date: 2026-09-09

"""
import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0002_posts_and_feed"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TOPICS = [
    ("it-tech", "IT и технологии", "IT va texnologiyalar", 1),
    ("education", "Образование", "Ta'lim", 2),
    ("student-life", "Студенческая жизнь", "Talabalik hayoti", 3),
    ("work-business", "Работа и бизнес", "Ish va biznes", 4),
    ("news-society", "Новости и общество", "Yangiliklar va jamiyat", 5),
    ("sport", "Спорт", "Sport", 6),
    ("entertainment", "Развлечения и мемы", "Ko'ngilochar va memlar", 7),
]


def upgrade() -> None:
    op.create_table(
        "topics",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("slug", sa.String(length=50), nullable=False),
        sa.Column("name_ru", sa.String(length=100), nullable=False),
        sa.Column("name_uz", sa.String(length=100), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("slug", name="uq_topics_slug"),
    )

    topics_table = sa.table(
        "topics",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("slug", sa.String),
        sa.column("name_ru", sa.String),
        sa.column("name_uz", sa.String),
        sa.column("sort_order", sa.Integer),
    )
    op.bulk_insert(
        topics_table,
        [
            {"id": uuid.uuid4(), "slug": slug, "name_ru": name_ru, "name_uz": name_uz, "sort_order": order}
            for slug, name_ru, name_uz, order in TOPICS
        ],
    )

    op.create_table(
        "posts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "author_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("text", sa.String(length=500), nullable=True),
        sa.Column(
            "topic_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("topics.id", ondelete="RESTRICT"), nullable=False
        ),
        sa.Column("city", sa.String(length=100), nullable=True),
        sa.Column(
            "parent_post_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("posts.id", ondelete="CASCADE"), nullable=True
        ),
        sa.Column(
            "reply_to_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
        ),
        sa.Column("is_hidden", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("hidden_reason", sa.String(length=500), nullable=True),
        sa.Column(
            "hidden_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
        ),
        sa.Column("hidden_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_posts_author_id", "posts", ["author_id"])
    op.create_index("ix_posts_topic_id", "posts", ["topic_id"])
    op.create_index("ix_posts_parent_post_id", "posts", ["parent_post_id"])
    op.create_index("ix_posts_created_at", "posts", ["created_at"])

    op.create_table(
        "post_images",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "post_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("posts.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("url", sa.String(length=500), nullable=False),
        sa.Column("thumbnail_url", sa.String(length=500), nullable=False),
        sa.Column("width", sa.Integer(), nullable=False),
        sa.Column("height", sa.Integer(), nullable=False),
        sa.Column("alt_text", sa.String(length=300), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_post_images_post_id", "post_images", ["post_id"])

    op.create_table(
        "hashtags",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tag", sa.String(length=100), nullable=False),
        sa.UniqueConstraint("tag", name="uq_hashtags_tag"),
    )
    op.create_index("ix_hashtags_tag", "hashtags", ["tag"])

    op.create_table(
        "post_hashtags",
        sa.Column(
            "post_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("posts.id", ondelete="CASCADE"), primary_key=True
        ),
        sa.Column(
            "hashtag_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("hashtags.id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )
    op.create_index("ix_post_hashtags_hashtag_id", "post_hashtags", ["hashtag_id"])

    op.create_table(
        "post_mentions",
        sa.Column(
            "post_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("posts.id", ondelete="CASCADE"), primary_key=True
        ),
        sa.Column(
            "mentioned_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )
    op.create_index("ix_post_mentions_mentioned_user_id", "post_mentions", ["mentioned_user_id"])

    for table_name in ("likes", "reposts", "bookmarks"):
        op.create_table(
            table_name,
            sa.Column(
                "user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
            ),
            sa.Column(
                "post_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("posts.id", ondelete="CASCADE"), primary_key=True
            ),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )
        op.create_index(f"ix_{table_name}_post_id", table_name, ["post_id"])

    op.create_table(
        "follows",
        sa.Column(
            "follower_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
        ),
        sa.Column(
            "followee_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_follows_followee_id", "follows", ["followee_id"])


def downgrade() -> None:
    op.drop_table("follows")
    for table_name in ("bookmarks", "reposts", "likes"):
        op.drop_table(table_name)
    op.drop_table("post_mentions")
    op.drop_table("post_hashtags")
    op.drop_table("hashtags")
    op.drop_table("post_images")
    op.drop_table("posts")
    op.drop_table("topics")
