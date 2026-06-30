"""user-device

Revision ID: 7ef70d58ea9d
Revises: 9c3fc2d67ce7
Create Date: 2026-06-29 15:59:46.135162

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from database.migrate import fk, m2m


# revision identifiers, used by Alembic.
revision: str = '7ef70d58ea9d'
down_revision: Union[str, None] = '9c3fc2d67ce7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    m2m(op, sa, 'snowgroove_user.id', 'remote_player.id')


def downgrade() -> None:
    pass
