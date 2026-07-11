"""music-session

Revision ID: 8aa6ac40ed03
Revises: 30ccb9ff157c
Create Date: 2026-06-07 21:16:59.211076

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from database.migrate import fk, m2m

# revision identifiers, used by Alembic.
revision: str = '8aa6ac40ed03'
down_revision: Union[str, None] = '30ccb9ff157c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'remote_player',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('created_at', sa.DateTime, nullable=False),
        sa.Column('updated_at', sa.DateTime, nullable=False),
        sa.Column('kind', sa.Text, nullable=False),
        sa.Column('device_make', sa.Text, nullable=False),
        sa.Column('name', sa.Text, nullable=False),
        sa.Column('connection_info_json', sa.Text, nullable=False),
    )

    op.create_table(
        'music_session',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('created_at', sa.DateTime, nullable=False),
        sa.Column('updated_at', sa.DateTime, nullable=False),
        fk(sa, 'remote_player.id', nullable=True),
        fk(sa, 'client_device_user.id', nullable=True),
        sa.Column('kind', sa.Text, nullable=False),
        sa.Column('music_queue_json', sa.Text, nullable=True),
        sa.CheckConstraint(
            '(remote_player_id IS NULL AND client_device_user_id IS NOT NULL) OR '
            '(remote_player_id IS NOT NULL AND client_device_user_id IS NULL)',
            name='check_device_is_assigned_to_session',
        ),
    )


def downgrade() -> None:
    pass
