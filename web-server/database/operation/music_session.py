from database.operation.db_internal import dbi


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


def update_music_session_music_queue(music_session_id: int, music_queue: dict):
    with dbi.session() as db:
        (
            db.query(dbi.dm.MusicSession)
            .filter(dbi.dm.MusicSession.id == music_session_id)
            .update({'music_queue_json': dbi.json.dumps(music_queue)})
        )
        db.commit()
        return True


def get_music_session_by_remote_player_id(remote_player_id: int):
    with dbi.session() as db:
        return (
            db.query(dbi.dm.MusicSession)
            .filter(dbi.dm.MusicSession.remote_player_id == remote_player_id)
            .options(dbi.orm.joinedload(dbi.dm.MusicSession.remote_player))
            .first()
        )


def get_music_session_by_cduid(cduid: int):
    with dbi.session() as db:
        return (
            db.query(dbi.dm.MusicSession)
            .filter(dbi.dm.MusicSession.client_device_user_id == cduid)
            .options(dbi.orm.joinedload(dbi.dm.MusicSession.client_device_user))
            .first()
        )


def get_or_create_music_session(remote_player_id: int = None, cduid: int = None):
    if remote_player_id:
        music_session = get_music_session_by_remote_player_id(
            remote_player_id=remote_player_id
        )
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
            cduid=cduid,
        )
    if music_session.music_queue_json:
        music_session.music_queue = dbi.json.loads(music_session.music_queue_json)
    return music_session


def get_music_session_list():
    with dbi.session() as db:
        return db.query(dbi.dm.MusicSession).all()
