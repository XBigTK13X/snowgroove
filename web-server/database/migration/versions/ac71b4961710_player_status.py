"""player_status

Revision ID: ac71b4961710
Revises: e3e785c7253b
Create Date: 2026-09-23 21:38:39.085318

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'ac71b4961710'
down_revision: Union[str, None] = 'e3e785c7253b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('remote_player', sa.Column('is_online', sa.Boolean, nullable=True))
    op.add_column('remote_player', sa.Column('is_playing', sa.Boolean, nullable=True))
    op.add_column('remote_player', sa.Column('volume', sa.Float, nullable=True))
    op.add_column('remote_player', sa.Column('player_state', sa.Text, nullable=True))
    op.add_column('remote_player', sa.Column('last_seen', sa.DateTime, nullable=True))


def downgrade() -> None:
    pass
