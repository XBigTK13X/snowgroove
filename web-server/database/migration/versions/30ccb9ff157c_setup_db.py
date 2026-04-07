"""setup_db

Revision ID: 30ccb9ff157c
Revises:
Create Date: 2026-04-07 13:51:10.598127

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '30ccb9ff157c'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS unaccent")

    op.create_table(
        "snowgroove_user",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
        sa.Column("username", sa.Text, nullable=False),
        sa.Column("display_name", sa.Text),
        sa.Column("hashed_password", sa.Text, nullable=True),
        sa.Column("has_password", sa.Boolean, default=False),
        sa.Column("enabled", sa.Boolean, default=True),
        sa.Column("permissions", sa.Text),
    )

    op.create_unique_constraint("unique_user_username", "snowstream_user", ["username"])

    # admin user
    # username: 'admin'
    # password: 'admin'
    op.execute(
        '''INSERT INTO snowstream_user
        (
            id,
            created_at,
            updated_at,
            username,
            display_name,
            hashed_password,
            has_password,
            enabled,
            permissions
        )
           VALUES
        (
            0,
            NOW(),
            NOW(),
            'admin',
            'admin',
            '$2b$12$Mm.mD4U2Ws7tyBeBwUXD7ehxZhH8RcClHkY.mi34VMGeQKAv98ek6',
            'true',
            'true',
            'admin'
        );'''
    )

    op.create_table(
        "job",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
        sa.Column("kind", sa.Text, nullable=False),
        sa.Column("message", sa.Text),
        sa.Column("status", sa.Text),
        sa.Column("logs_json", sa.Text),
        sa.Column("input_json", sa.Text)
    )

    op.create_table(
        "cached_text",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
        sa.Column("time_to_live_seconds", sa.Integer, nullable=False),
        sa.Column("key", sa.Text, nullable=False),
        sa.Column("data", sa.Text, nullable=False),
    )

    op.create_table(
        "tag",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
        sa.Column("name", sa.Text, nullable=False),
    )

    op.create_unique_constraint("unique_tag_name", "tag", ["name"])

    op.create_table(
        "tag_rule",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
        sa.Column(
            "tag_id",
            sa.Integer,
            sa.ForeignKey("tag.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("rule_kind", sa.Text),
        sa.Column("priority", sa.Integer),
        sa.Column("target_kind", sa.Text),
        sa.Column("trigger_kind", sa.Text),
        sa.Column("trigger_target", sa.Text),
    )

    op.create_table(
        "shelf",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("kind", sa.Text),
        sa.Column("local_path", sa.Text),
        sa.Column("network_path", sa.Text),
    )

    op.create_unique_constraint("unique_shelf_local_path", "shelf", ["local_path"])
    op.create_unique_constraint("unique_shelf_network_path", "shelf", ["local_path"])

    op.create_table(
        "music_file",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
        sa.Column("shelf_id", sa.Integer, sa.ForeignKey("shelf.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.Text, nullable=False),
        sa.Column("local_path", sa.Text, nullable=False),
        sa.Column("web_path", sa.Text, nullable=False),
        sa.Column("network_path", sa.Text, nullable=False),
        sa.Column('snowstream_info_json', sa.Text),
        sa.Column('ffprobe_raw_json', sa.Text),
        sa.Column('mediainfo_raw_json', sa.Text),
        sa.Column('thumbnail_web_path', sa.Text),
        sa.Column("version", sa.Text, nullable=True),
        sa.Column("name", sa.Text, nullable=False)
    )

    op.create_unique_constraint("unique_music_file_local_path", "music_file", ["local_path"])
    op.create_unique_constraint("unique_music_file_web_path", "music_file", ["web_path"])
    op.create_unique_constraint("unique_music_file_network_path", "music_file", ["network_path"])

    op.create_table(
        "image_file",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
        sa.Column("shelf_id", sa.Integer, sa.ForeignKey("shelf.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.Text, nullable=False),
        sa.Column("local_path", sa.Text, nullable=False),
        sa.Column("web_path", sa.Text, nullable=False),
        sa.Column("network_path", sa.Text, nullable=False),
        sa.Column("thumbnail_web_path", sa.Text, nullable=False),
    )

    op.create_unique_constraint("unique_image_file_local_path", "image_file", ["local_path"])
    op.create_unique_constraint("unique_image_file_web_path", "image_file", ["web_path"])
    op.create_unique_constraint("unique_image_file_network_path", "image_file", ["network_path"])

    op.create_table(
        "metadata_file",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
        sa.Column("shelf_id", sa.Integer, sa.ForeignKey("shelf.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.Text, nullable=False),
        sa.Column("local_path", sa.Text, nullable=False),
        sa.Column("web_path", sa.Text, nullable=False),
        sa.Column("network_path", sa.Text, nullable=False),
        sa.Column("xml_content", sa.Text, nullable=False),
    )

    op.create_unique_constraint("unique_metadata_file_local_path", "metadata_file", ["local_path"])
    op.create_unique_constraint("unique_metadata_file_web_path", "metadata_file", ["web_path"])
    op.create_unique_constraint("unique_metadata_file_network_path", "metadata_file", ["network_path"])

    op.create_table(
        "user_tag",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("snowstream_user.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "tag_id",
            sa.Integer,
            sa.ForeignKey("tag.id", ondelete="CASCADE"),
            nullable=False,
        ),
    )

    op.create_unique_constraint(
        "unique_user_tag",
        "user_tag",
        ["user_id", "tag_id"],
    )

    op.create_table(
        "user_shelf",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("snowstream_user.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "shelf_id",
            sa.Integer,
            sa.ForeignKey("shelf.id", ondelete="CASCADE"),
            nullable=False,
        ),
    )

    op.create_unique_constraint(
        "unique_user_shelf",
        "user_shelf",
        ["user_id", "shelf_id"],
    )

    op.create_table(
        "user_stream_source",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("snowstream_user.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "stream_source_id",
            sa.Integer,
            sa.ForeignKey("stream_source.id", ondelete="CASCADE"),
            nullable=False,
        ),
    )

    op.create_unique_constraint(
        "unique_user_stream_source",
        "user_stream_source",
        ["user_id", "stream_source_id"],
    )

    op.create_table(
        "client_device",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
        sa.Column("reported_name", sa.Text, nullable=False),
        sa.Column("display_name", sa.Text),
        sa.Column("device_kind", sa.Text),
    )

    op.create_unique_constraint("unique_client_device_reported_name", "client_device", ["reported_name"])
    op.create_unique_constraint("unique_client_device_display_name", "client_device", ["display_name"])

    op.create_table(
        "client_device_user",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
        sa.Column(
            "client_device_id",
            sa.Integer,
            sa.ForeignKey("client_device.id",ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("snowstream_user.id",ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("isolation_mode", sa.Text),
        sa.Column("last_connection", sa.DateTime, nullable=False)
    )

    op.create_unique_constraint(
        "unique_client_device_user",
        "client_device_user",
        ["client_device_id","user_id"]
    )

    op.create_table(
        "listen_progress",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),

        sa.Column(
            "client_device_user_id",
            sa.Integer,
            sa.ForeignKey("client_device_user.id",ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "movie_id",
            sa.Integer,
            sa.ForeignKey("movie.id",ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "show_episode_id",
            sa.Integer,
            sa.ForeignKey("show_episode.id",ondelete="CASCADE"),
            nullable=True,
        ),

        sa.Column(
            "streamable_id",
            sa.Integer,
            sa.ForeignKey("streamable.id",ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("played_seconds", sa.Float),
        sa.Column("duration_seconds", sa.Float)
    )

    op.create_table(
        'listen_count',
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
        sa.Column(
            "client_device_user_id",
            sa.Integer,
            sa.ForeignKey("client_device_user.id",ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "movie_id",
            sa.Integer,
            sa.ForeignKey("movie.id",ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "show_episode_id",
            sa.Integer,
            sa.ForeignKey("show_episode.id",ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "streamable_id",
            sa.Integer,
            sa.ForeignKey("streamable.id",ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column('amount', sa.Integer)
    )

    op.create_table(
        'listened',
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
        sa.Column(
            "client_device_user_id",
            sa.Integer,
            sa.ForeignKey("client_device_user.id",ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "shelf_id",
            sa.Integer,
            sa.ForeignKey('shelf.id',ondelete="CASCADE"),
            nullable=True
        ),
        sa.Column(
            "movie_id",
            sa.Integer,
            sa.ForeignKey("movie.id",ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "show_id",
            sa.Integer,
            sa.ForeignKey("show.id",ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "show_season_id",
            sa.Integer,
            sa.ForeignKey("show_season.id",ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "show_episode_id",
            sa.Integer,
            sa.ForeignKey("show_episode.id",ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "streamable_id",
            sa.Integer,
            sa.ForeignKey("streamable.id",ondelete="CASCADE"),
            nullable=True,
        )
    )

def downgrade() -> None:
    pass
