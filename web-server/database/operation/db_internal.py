from box import Box
from datetime import datetime, timezone
import json
import os
import snow_media.toml

import sqlalchemy as sa
import sqlalchemy.orm as orm
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine, or_, update
from sqlalchemy import text as sql_text
from sqlalchemy.sql import func, desc

import database.db_models as dm

from log import log
from settings import config
import util

dbi = Box(
    {
        'config': config,
        'datetime': datetime,
        'desc': desc,
        'dm': dm,
        'engine': create_engine(config.postgres_url),
        'func': func,
        'json': json,
        'log': log,
        'or_': or_,
        'orm': orm,
        'os': os,
        'sa': sa,
        'sql_text': sql_text,
        'Ticket': dm.Ticket,
        'timezone': timezone,
        'toml': snow_media.toml,
        'up': update,
        'util': util,
    }
)

dbi.session = sessionmaker(autocommit=False, autoflush=False, bind=dbi.engine)
