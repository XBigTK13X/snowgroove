from log import log
from db import db
import api_models as am
import os
from message.job_media_scope import JobMediaScope
from remote_player import remote_player


def handle(scope: JobMediaScope):
    db.op.update_job(
        job_id=scope.job_id, message=f'[WORKER] Handling a scan_remote_players job'
    )

    found_players = remote_player.scan_remote_players(job_id=scope.job_id)

    db.op.update_job(
        job_id=scope.job_id, message=f'Found [{len(found_players)}] remote players'
    )

    return True
