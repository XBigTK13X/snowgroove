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

def fk(field,nullable=False):
    return sa.Column(
        field.replace('.','_'),
        sa.Integer,
        sa.ForeignKey(field,ondelete="CASCADE"),
        nullable=nullable
    )

def m2m(field1,field2):
    name1 = field1.replace('.','_')
    name2 = field2.replace('.','_')
    title1 = field1.split('.')[0]
    title2 = field2.split('.')[0]
    title = f'{title1}_{title2}'
    op.create_table(
        title,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
        fk(field1),
        fk(field2)
    )

    op.create_unique_constraint(f"unique_{title}", title, [name1, name2])

def user_schema():
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

    op.create_unique_constraint("unique_user_username", "snowgroove_user", ["username"])

    # admin user
    # username: 'admin'
    # password: 'admin'
    op.execute(
        '''INSERT INTO snowgroove_user
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
            "snowgroove_user_id",
            sa.Integer,
            sa.ForeignKey("snowgroove_user.id",ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("isolation_mode", sa.Text),
        sa.Column("last_connection", sa.DateTime, nullable=False)
    )

    op.create_unique_constraint(
        "unique_client_device_user",
        "client_device_user",
        ["client_device_id","snowgroove_user_id"]
    )

def audio_schema():
    op.create_table(
        "album",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
        fk("crate.id"),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("year", sa.Text, nullable=True),
    )

    op.create_table(
        "audio_file",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
        fk("crate.id"),
        sa.Column("album",sa.Text,nullable=True),
        sa.Column("artist",sa.Text,nullable=True),
        sa.Column("disc", sa.Text, nullable=True),
        sa.Column("duration", sa.Float, nullable=False),
        sa.Column("ffprobe_raw_json", sa.Text),
        sa.Column("kind", sa.Text, nullable=False),
        sa.Column("local_path", sa.Text, nullable=False),
        sa.Column("lyrics", sa.Text, nullable=True),
        sa.Column("mediainfo_raw_json", sa.Text),
        sa.Column("network_path", sa.Text, nullable=False),
        sa.Column("path", sa.Text, nullable=True),
        sa.Column("position", sa.Text, nullable=True),
        sa.Column("snowgroove_info_json", sa.Text),
        sa.Column("thumbnail_web_path", sa.Text),
        sa.Column("fingerprint", sa.Text, nullable=False),
        sa.Column("title", sa.Text, nullable=False),
        sa.Column("track", sa.Text, nullable=True),
        sa.Column("web_path", sa.Text, nullable=False),
        sa.Column("year", sa.Float, nullable=True)
    )

    op.create_unique_constraint("unique_audio_file_local_path", "audio_file", ["local_path"])
    op.create_unique_constraint("unique_audio_file_web_path", "audio_file", ["web_path"])
    op.create_unique_constraint("unique_audio_file_network_path", "audio_file", ["network_path"])

    op.create_table(
        "artist",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
        sa.Column("name", sa.Text, nullable=False)
    )

def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS unaccent")

    user_schema()

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
        fk('tag.id',nullable=True),
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
        "crate",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
        sa.Column("shelf_id", sa.Integer, sa.ForeignKey("shelf.id", ondelete="CASCADE"), nullable=False),
        sa.Column("directory", sa.Text, nullable=False),
        sa.Column("parent_crate_id", sa.Integer, sa.ForeignKey("crate.id", ondelete="CASCADE"), nullable=True),
    )

    op.create_unique_constraint("unique_crate_directory", "crate", ["directory"])

    op.create_table(
        "image_file",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
        fk('crate.id'),
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
        fk('crate.id'),
        sa.Column("kind", sa.Text, nullable=False),
        sa.Column("local_path", sa.Text, nullable=False),
        sa.Column("web_path", sa.Text, nullable=False),
        sa.Column("network_path", sa.Text, nullable=False),
        sa.Column("file_content", sa.Text, nullable=False),
    )

    op.create_unique_constraint("unique_metadata_file_local_path", "metadata_file", ["local_path"])
    op.create_unique_constraint("unique_metadata_file_web_path", "metadata_file", ["web_path"])
    op.create_unique_constraint("unique_metadata_file_network_path", "metadata_file", ["network_path"])

    audio_schema()

    m2m('crate.id','artist.id')

    m2m('snowgroove_user.id','tag.id')
    m2m('snowgroove_user.id','shelf.id')
    m2m('snowgroove_user.id','crate.id')
    m2m('snowgroove_user.id','album.id')
    m2m('snowgroove_user.id','artist.id')

def downgrade() -> None:
    pass
