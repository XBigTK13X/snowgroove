"""music-session

Revision ID: 8aa6ac40ed03
Revises: 30ccb9ff157c
Create Date: 2026-06-07 21:16:59.211076

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from database.migrate import fk,m2m

# revision identifiers, used by Alembic.
revision: str = '8aa6ac40ed03'
down_revision: Union[str, None] = '30ccb9ff157c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.create_table(
        "remote_player",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
        sa.Column("kind", sa.Text, nullable=False),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("connection_info", sa.Text, nullable=False)
    )
    op.create_table(
        "music_session",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
        sa.Column("snowgroove_user_id",sa.Integer, sa.ForeignKey('snowgroove_user.id',ondelete="CASCADE"),nullable=False),
        sa.Column("remote_device_id", sa.Integer, sa.ForeignKey('remote_player.id',ondelete="CASCADE"),nullable=True),
        sa.Column("local_device_id", sa.Integer, sa.ForeignKey('client_device.id',ondelete="CASCADE"),nullable=True)
        sa.Column("kind", sa.Text, nullable=False),
        sa.Column("music_queue_json", sa.Text, nullable=True),
        sa.CheckConstraint(
            "(remote_device_id IS NULL AND local_device_id IS NOT NULL) OR "
            "(remote_device_id IS NOT NULL AND local_device_id IS NULL)",
            name="check_device_is_assigned_to_session"
        )
    )

def downgrade() -> None:
    pass
