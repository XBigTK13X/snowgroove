from database.operation.db_internal import dbi


def create_playlist(
    snowgroove_user_id: int, name: str, audio_file_fingerprints: list[str] = None
):
    with dbi.session() as db:
        dbm = dbi.dm.Playlist()
        dbm.snowgroove_user_id = snowgroove_user_id
        dbm.name = name
        dbm.audio_file_fingerprints_json = dbi.json.dumps(audio_file_fingerprints)

        db.add(dbm)
        db.commit()
        db.refresh(dbm)
        return dbm


def update_playlist(id: int, name: str, audio_file_fingerprints: list[str]):
    if not id:
        return None
    with dbi.session() as db:
        (
            db.query(dbi.dm.Playlist)
            .filter(dbi.dm.Playlist.id == id)
            .update(
                {
                    'audio_file_fingerprints_json': dbi.json.dumps(
                        audio_file_fingerprints
                    ),
                    'name': name,
                }
            )
        )
        db.commit()
        return db.query(dbi.dm.Playlist).filter(dbi.dm.Playlist.id == id).first()


def get_playlist_by_id(id: int):
    with dbi.session() as db:
        return db.query(dbi.dm.Playlist).filter(dbi.dm.Playlist.id == id).first()


def upsert_playlist(
    id: int, name: str, audio_file_fingerprints: list[str], snowgroove_user_id: int
):
    if id:
        playlist = update_playlist(
            id=id, name=name, audio_file_fingerprints=audio_file_fingerprints
        )
    else:
        playlist = create_playlist(
            snowgroove_user_id=snowgroove_user_id,
            name=name,
            audio_file_fingerprints=audio_file_fingerprints,
        )

    if playlist.audio_file_fingerprints_json:
        playlist.audio_file_fingerprints = dbi.json.loads(
            playlist.audio_file_fingerprints_json
        )
        playlist.audio_files = []
    return playlist


def get_playlist_list():
    with dbi.session() as db:
        return db.query(dbi.dm.Playlist).all()
