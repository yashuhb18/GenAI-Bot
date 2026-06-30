"""add mode column to conversations

Revision ID: 002
"""
from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column(
        "conversations",
        sa.Column("mode", sa.String(50), server_default="general", nullable=False),
    )


def downgrade():
    op.drop_column("conversations", "mode")
