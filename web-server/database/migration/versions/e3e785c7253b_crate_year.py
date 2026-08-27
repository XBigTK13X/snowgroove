"""crate-year

Revision ID: e3e785c7253b
Revises: 25f434b66d92
Create Date: 2026-08-27 08:28:32.567145

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e3e785c7253b'
down_revision: Union[str, None] = '25f434b66d92'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('crate', sa.Column('year', sa.Integer(), nullable=True, default=None))
    op.add_column(
        'crate', sa.Column('year_order', sa.Integer(), nullable=True, default=None)
    )


def downgrade() -> None:
    pass
