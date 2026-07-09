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
        playlist = db.query(dbi.dm.Playlist).filter(dbi.dm.Playlist.id == id).first()
        if not playlist or not playlist.audio_file_fingerprints_json:
            return playlist

        fingerprints = dbi.json.loads(playlist.audio_file_fingerprints_json)
        if not fingerprints:
            playlist.audio_files = []
            return playlist

        audio_files = (
            db.query(dbi.dm.AudioFile)
            .filter(dbi.dm.AudioFile.fingerprint.in_(fingerprints))
            .all()
        )

        order_map = {fingerprint: idx for idx, fingerprint in enumerate(fingerprints)}
        audio_files.sort(key=lambda x: order_map.get(x.fingerprint, 0))

        crate_ids = [
            file.crate_id
            for file in audio_files
            if not file.thumbnail_web_path and file.crate_id
        ]

        if crate_ids:
            crates = (
                db.query(dbi.dm.Crate).filter(dbi.dm.Crate.id.in_(set(crate_ids))).all()
            )

            crate_map = {}
            for crate in crates:
                crate_with_images = dbi.dm.set_primary_images(crate)
                crate_map[crate_with_images.id] = crate_with_images

            for file in audio_files:
                if not file.thumbnail_web_path and file.crate_id in crate_map:
                    matched_crate = crate_map[file.crate_id]
                    file.thumbnail_web_path = matched_crate.album_cover_image_url

        playlist.audio_files = audio_files
        del playlist.audio_file_fingerprints_json

        return playlist


def get_playlist_by_name(name: str):
    with dbi.session() as db:
        return db.query(dbi.dm.Playlist).filter(dbi.dm.Playlist.name == name).first()


def upsert_playlist(
    id: int, name: str, audio_file_fingerprints: list[str], snowgroove_user_id: int
):
    with dbi.session() as db:
        existing = (
            db.query(dbi.dm.Playlist)
            .filter(dbi.or_(dbi.dm.Playlist.name == name, dbi.dm.Playlist.id == id))
            .first()
        )
        if existing:
            playlist = update_playlist(
                id=existing.id,
                name=name,
                audio_file_fingerprints=audio_file_fingerprints,
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
        return db.query(dbi.dm.Playlist).order_by(dbi.dm.Playlist.name).all()
