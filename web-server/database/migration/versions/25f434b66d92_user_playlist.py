"""user_playlist

Revision ID: 25f434b66d92
Revises: 8d3145584046
Create Date: 2026-07-20 18:45:51.133033

"""

from typing import Sequence, Union
from database.migrate import fk, m2m

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '25f434b66d92'
down_revision: Union[str, None] = '8d3145584046'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'snowgroove_user_playlist',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('created_at', sa.DateTime, nullable=False),
        sa.Column('updated_at', sa.DateTime, nullable=False),
        fk(sa, 'snowgroove_user.id', nullable=False),
        sa.Column('playlist_name', sa.Text, nullable=False),
    )


def downgrade() -> None:
    pass
