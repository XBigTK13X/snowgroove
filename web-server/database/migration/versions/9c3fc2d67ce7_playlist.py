"""playlist

Revision ID: 9c3fc2d67ce7
Revises: 8aa6ac40ed03
Create Date: 2026-06-23 14:13:50.804707

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from database.migrate import fk, m2m

# revision identifiers, used by Alembic.
revision: str = '9c3fc2d67ce7'
down_revision: Union[str, None] = '8aa6ac40ed03'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'playlist',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('created_at', sa.DateTime, nullable=False),
        sa.Column('updated_at', sa.DateTime, nullable=False),
        fk(sa, 'snowgroove_user.id'),
        sa.Column('audio_file_fingerprints_json', sa.Text, nullable=False),
        sa.Column('name', sa.Text, nullable=False),
    )


def downgrade() -> None:
    pass
