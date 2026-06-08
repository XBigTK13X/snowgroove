from db import db
import remote_player.chromecast as chromecast
import remote_player.sonos as sonos


def scan_remote_players(job_id: int):
    db.op.update_job(job_id=job_id, message=f'Searching for Chromecast devices')
    chromecast_players = chromecast.scan_remote_players()
    db.op.update_job(job_id=job_id, message=f'Searching for Sonos devices')
    sonos_players = sonos.scan_remote_players()
    remote_players = chromecast_players + sonos_players
    for remote_player in remote_players:
        db.op.update_job(
            job_id=job_id,
            message=f'Discovered remote_player [{remote_player["kind"]}] [{remote_player["name"]}]',
        )
        db.op.upsert_remote_player(
            name=remote_player['name'],
            kind=remote_player['kind'],
            connection_info_json=remote_player['connection_info_json'],
        )
    return remote_players
