from database.operation.db_internal import dbi


def create_playlist(
    snowgroove_user_id: int, name: str, audio_file_fingerprints: list[str] = None
):
    with dbi.session() as db:
        dbm = dbi.dm.Playlist()
        dbm.snowgroove_user_id = snowgroove_user_id
        dbm.name = name
        dbm.version = 1
        dbm.archived = False
        dbm.audio_file_fingerprints_json = dbi.json.dumps(audio_file_fingerprints or [])

        db.add(dbm)
        db.commit()
        db.refresh(dbm)
        return dbm


def update_playlist(id: int, name: str, audio_file_fingerprints: list[str]):
    if not id:
        return None
    with dbi.session() as db:
        existing = db.query(dbi.dm.Playlist).filter(dbi.dm.Playlist.id == id).first()
        if not existing:
            return None

        old_name = existing.name
        if old_name != name:
            (
                db.query(dbi.dm.Playlist)
                .filter(dbi.dm.Playlist.name == old_name)
                .update({'name': name}, synchronize_session=False)
            )
            (
                db.query(dbi.dm.UserPlaylist)
                .filter(dbi.dm.UserPlaylist.playlist_name == old_name)
                .update({'playlist_name': name}, synchronize_session=False)
            )

        target_name = name if old_name != name else existing.name

        current_max_version = (
            db.query(dbi.func.max(dbi.func.coalesce(dbi.dm.Playlist.version, 1)))
            .filter(dbi.dm.Playlist.name == target_name)
            .scalar()
        ) or 1

        dbm = dbi.dm.Playlist()
        dbm.snowgroove_user_id = existing.snowgroove_user_id
        dbm.name = target_name
        dbm.version = current_max_version + 1
        dbm.archived = False
        if audio_file_fingerprints is not None:
            dbm.audio_file_fingerprints_json = dbi.json.dumps(audio_file_fingerprints)
        else:
            dbm.audio_file_fingerprints_json = existing.audio_file_fingerprints_json

        db.add(dbm)
        db.commit()
        db.refresh(dbm)
        return dbm


def get_playlist_by_id(id: int):
    with dbi.session() as db:
        playlist = db.query(dbi.dm.Playlist).filter(dbi.dm.Playlist.id == id).first()
        if not playlist:
            return None

        latest_playlist = (
            db.query(dbi.dm.Playlist)
            .filter(dbi.dm.Playlist.name == playlist.name)
            .order_by(dbi.dm.Playlist.version.desc())
            .first()
        )

        if not latest_playlist:
            return None

        playlist = latest_playlist

        if not playlist.audio_file_fingerprints_json:
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
        audio_files.sort(key=lambda xx: order_map.get(xx.fingerprint, 0))

        crate_ids = [file.crate_id for file in audio_files if file.crate_id]

        if crate_ids:
            crates = (
                db.query(dbi.dm.Crate)
                .filter(dbi.dm.Crate.id.in_(set(crate_ids)))
                .options(dbi.orm.joinedload(dbi.dm.Crate.parent))
                .all()
            )

            crate_map = {}
            for crate in crates:
                crate_with_images = dbi.dm.set_primary_images(crate)
                crate_map[crate_with_images.id] = crate_with_images

            for file in audio_files:
                if file.crate_id in crate_map:
                    matched_crate = crate_map[file.crate_id]
                    if not file.thumbnail_web_path:
                        file.thumbnail_web_path = matched_crate.album_cover_image_url

                    file.album_crate_id = matched_crate.id
                    file.artist_crate_id = (
                        matched_crate.parent_crate_id
                        if matched_crate.parent_crate_id
                        else None
                    )
                else:
                    file.album_crate_id = None
                    file.artist_crate_id = None

        playlist.audio_files = audio_files
        del playlist.audio_file_fingerprints_json

        return playlist


def get_playlist_by_name(name: str):
    with dbi.session() as db:
        return (
            db.query(dbi.dm.Playlist)
            .filter(dbi.dm.Playlist.name == name)
            .order_by(dbi.dm.Playlist.version.desc())
            .first()
        )


def upsert_playlist(
    ticket: dbi.dm.Ticket,
    id: int,
    name: str,
    audio_file_fingerprints: list[str],
    snowgroove_user_id: int,
):
    with dbi.session() as db:
        query_filters = [dbi.dm.Playlist.name == name]
        if id:
            query_filters.append(dbi.dm.Playlist.id == id)

        existing = (
            db.query(dbi.dm.Playlist)
            .filter(dbi.or_(*query_filters))
            .order_by(dbi.dm.Playlist.version.desc())
            .first()
        )
        if existing:
            if (
                not snowgroove_user_id == existing.snowgroove_user_id
                and not ticket.is_admin
            ):
                return {
                    'error': f"Unable to modify another user's playlist [{existing.name}]->[{existing.snowgroove_user_id}]"
                }
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

        if playlist and playlist.audio_file_fingerprints_json:
            playlist.audio_file_fingerprints = dbi.json.loads(
                playlist.audio_file_fingerprints_json
            )
            playlist.audio_files = []
        return playlist


def get_playlist_list(ticket: dbi.dm.Ticket, flatten: bool = False):
    with dbi.session() as db:
        all_playlists = (
            db.query(dbi.dm.Playlist, dbi.dm.User.username)
            .outerjoin(
                dbi.dm.User,
                dbi.dm.Playlist.snowgroove_user_id == dbi.dm.User.id,
            )
            .order_by(
                dbi.dm.Playlist.name,
                dbi.dm.Playlist.version.desc(),
                dbi.dm.Playlist.id.desc(),
            )
            .all()
        )

        seen_names = set()
        latest_results = []
        for playlist, username in all_playlists:
            if playlist.name in seen_names:
                continue
            seen_names.add(playlist.name)
            latest_results.append((playlist, username))

        owners = []
        playlists = {}
        flattened = []
        for playlist, username in latest_results:
            if ticket is not None:
                if (
                    not ticket.is_admin
                    and ticket.snowgroove_username != username
                    and not ticket.is_allowed(playlist_name=playlist.name)
                ):
                    continue
            if flatten:
                if (
                    playlist.snowgroove_user_id == ticket.snowgroove_user_id
                    or ticket.is_admin
                ):
                    flattened.append(playlist)
            else:
                if username not in owners:
                    owners.append(username)
                    playlists[username] = []
                playlists[username].append(playlist)

        if flatten:
            flattened.sort(key=lambda xx: xx.name)
            return flattened

        target_username = ticket.snowgroove_username if ticket else None
        owners.sort(key=lambda xx: (xx != target_username, xx or ''))

        for owner in owners:
            playlists[owner].sort(key=lambda xx: xx.name)
        return {'owners': owners, 'playlists': playlists}


def add_song_to_playlist(playlist_id: int, audio_file_fingerprint: str):
    if not playlist_id or not audio_file_fingerprint:
        return None

    with dbi.session() as db:
        existing = (
            db.query(dbi.dm.Playlist).filter(dbi.dm.Playlist.id == playlist_id).first()
        )
        if not existing:
            return None

        latest_record = (
            db.query(dbi.dm.Playlist)
            .filter(dbi.dm.Playlist.name == existing.name)
            .order_by(dbi.dm.Playlist.version.desc())
            .first()
        )
        if latest_record:
            existing = latest_record

        fingerprints = []
        if existing.audio_file_fingerprints_json:
            fingerprints = dbi.json.loads(existing.audio_file_fingerprints_json) or []

        if audio_file_fingerprint in fingerprints:
            return None

        fingerprints.append(audio_file_fingerprint)

        return update_playlist(
            id=existing.id,
            name=existing.name,
            audio_file_fingerprints=fingerprints,
        )
