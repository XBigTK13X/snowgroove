from datetime import datetime, timezone
import json
import os

import sqlalchemy as sa
import sqlalchemy.orm as orm
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine, or_
from sqlalchemy import text as sql_text
from sqlalchemy.sql import func, desc

import database.db_models as dm

from log import log
from settings import config
import util

dbi = Box({
    "engine": create_engine(config.postgres_url),
    "config": config,
    "datetime": datetime,
    "desc": desc,
    "dm": dm,
    "func": func,
    "json": json,
    "log": log,
    "os": os,
    "sa": sa,
    "orm": orm,
    "sql_text": sql_text,
    "Ticket": dm.Ticket,
    "timezone": timezone,
    "util": util,
    "or_": or_
})

dbi.session = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=dbi.engine
)