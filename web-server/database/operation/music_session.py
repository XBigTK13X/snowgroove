from database.operation.db_internal import dbi
import database.operation.remote_player as db_remote_player


def create_music_session(
    music_queue: dict, cduid: int = None, remote_player_id: int = None
):
    with dbi.session() as db:
        dbm = dbi.dm.MusicSession()
        dbm.remote_player_id = remote_player_id
        dbm.client_device_user_id = cduid
        dbm.kind = 'local' if remote_player_id == None else 'remote'
        dbm.music_queue_json = dbi.json.dumps(music_queue)

        db.add(dbm)
        db.commit()
        db.refresh(dbm)
        return dbm


def load_music_queue(music_session):
    if not music_session:
        return None
    if music_session.music_queue_json:
        music_session.music_queue = dbi.json.loads(music_session.music_queue_json)
        del music_session.music_queue_json
        for song in music_session.music_queue['songs']:
            if 'snowgroove_info_json' in song:
                song['snowgroove_info'] = dbi.json.loads(song['snowgroove_info_json'])
                del song['snowgroove_info_json']
                del song['ffprobe_raw_json']
    return music_session


def update_music_session_music_queue(music_session_id: int, music_queue: dict):
    with dbi.session() as db:
        (
            db.query(dbi.dm.MusicSession)
            .filter(dbi.dm.MusicSession.id == music_session_id)
            .update({'music_queue_json': dbi.json.dumps(music_queue)})
        )
        db.commit()
        return load_music_queue(
            db.query(dbi.dm.MusicSession)
            .filter(dbi.dm.MusicSession.id == music_session_id)
            .first()
        )


def get_music_session_by_id(id: int):
    with dbi.session() as db:
        return (
            db.query(dbi.dm.MusicSession)
            .filter(dbi.dm.MusicSession.id == id)
            .options(dbi.orm.joinedload(dbi.dm.MusicSession.remote_player))
            .first()
        )


def get_music_session_by_remote_player_id(remote_player_id: int):
    with dbi.session() as db:
        return (
            db.query(dbi.dm.MusicSession)
            .filter(
                dbi.dm.MusicSession.remote_player_id == remote_player_id,
                dbi.dm.MusicSession.client_device_user_id.is_(None),
            )
            .options(dbi.orm.joinedload(dbi.dm.MusicSession.remote_player))
            .first()
        )


def get_music_session_by_cduid(cduid: int):
    with dbi.session() as db:
        cdu = (
            db.query(dbi.dm.ClientDeviceUser)
            .filter(dbi.dm.ClientDeviceUser.id == cduid)
            .first()
        )
        if not cdu:
            return None
        return (
            db.query(dbi.dm.MusicSession)
            .join(
                dbi.dm.ClientDeviceUser,
                dbi.dm.MusicSession.client_device_user_id == dbi.dm.ClientDeviceUser.id,
            )
            .filter(
                dbi.dm.ClientDeviceUser.snowgroove_user_id == cdu.snowgroove_user_id,
                dbi.dm.MusicSession.remote_player_id.is_(None),
            )
            .options(dbi.orm.joinedload(dbi.dm.MusicSession.client_device_user))
            .first()
        )


def get_or_create_music_session(
    remote_player_id: int = None, remote_player_name: str = None, cduid: int = None
):
    if remote_player_id:
        music_session = get_music_session_by_remote_player_id(
            remote_player_id=remote_player_id
        )
        if not music_session:
            remote_player = db_remote_player.get_remote_player_by_name(
                name=remote_player_name
            )
            if remote_player:
                music_session = get_music_session_by_remote_player_id(
                    remote_player_id=remote_player.id
                )
                remote_player_id = remote_player.id
    else:
        music_session = get_music_session_by_cduid(cduid=cduid)
    if not music_session:
        music_queue = {
            'current_song_index': 0,
            'songs': [],
            'device_volume': 100,
            'duration_seconds': 0,
            'remaining_seconds': 0,
            'repeat_mode': 'no-repeat',
        }
        music_session = create_music_session(
            music_queue=music_queue,
            remote_player_id=remote_player_id,
            cduid=cduid if remote_player_id == None else None,
        )
    return load_music_queue(music_session)


def get_music_session_list():
    with dbi.session() as db:
        sessions = (
            db.query(dbi.dm.MusicSession)
            .options(dbi.orm.joinedload(dbi.dm.MusicSession.remote_player))
            .options(dbi.orm.joinedload(dbi.dm.MusicSession.client_device_user))
            .all()
        )
        for session in sessions:
            if session.music_queue_json:
                load_music_queue(session)
        return sessions


def get_remote_music_session_list():
    with dbi.session() as db:
        return (
            db.query(dbi.dm.MusicSession)
            .filter(dbi.dm.MusicSession.remote_player_id.is_not(None))
            .options(dbi.orm.joinedload(dbi.dm.MusicSession.remote_player))
            .all()
        )
