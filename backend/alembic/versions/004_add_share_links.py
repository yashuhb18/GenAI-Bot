"""add share_links table

Revision ID: 004
"""
from alembic import op
import sqlalchemy as sa


def upgrade():
    op.create_table(
        "share_links",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("conversation_id", sa.String(36), sa.ForeignKey("conversations.id"), nullable=False),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_share_links_conversation_id", "share_links", ["conversation_id"])


def downgrade():
    op.drop_table("share_links")
