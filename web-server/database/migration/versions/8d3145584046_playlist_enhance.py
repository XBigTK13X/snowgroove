"""playlist-enhance

Revision ID: 8d3145584046
Revises: 7ef70d58ea9d
Create Date: 2026-07-20 08:20:06.818043

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8d3145584046'
down_revision: Union[str, None] = '7ef70d58ea9d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'playlist', sa.Column('version', sa.Integer(), nullable=False, default=1)
    )
    op.add_column(
        'playlist', sa.Column('archived', sa.Boolean(), nullable=False, default=False)
    )


def downgrade() -> None:
    pass
