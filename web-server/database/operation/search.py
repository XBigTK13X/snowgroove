from database.operation.db_internal import dbi
import database.operation.crate as db_crate


def perform_search(ticket: dbi.dm.Ticket, query: str):
    results = []
    with dbi.session() as db:
        u = dbi.func.unaccent
        uq = f'%{query}%'

        crates_data = db_crate.get_crate_list(search_query=query)
        directories = crates_data.get('directories', [])

        artists = []
        albums = []
        crates = []

        for directory in directories:
            populated_crate = db_crate.get_crate_by_id(
                ticket=ticket, crate_id=directory.id
            )
            if not populated_crate:
                continue

            if populated_crate.kind == 'artist':
                artists.append(populated_crate)
            elif populated_crate.kind == 'album':
                albums.append(populated_crate)
            else:
                crates.append(populated_crate)

        if artists:
            artists.sort(key=lambda xx: len(xx.title))
            results.append({'kind': 'artists', 'name': 'Artists', 'items': artists})

        if albums:
            albums.sort(key=lambda xx: len(xx.title))
            results.append({'kind': 'albums', 'name': 'Albums', 'items': albums})

        if crates:
            crates.sort(key=lambda xx: len(xx.title))
            results.append({'kind': 'crates', 'name': 'Crates', 'items': crates})

        matched_titles = (
            db.query(dbi.dm.AudioFile)
            .filter(u(dbi.dm.AudioFile.title).ilike(u(uq)))
            .all()
        )
        matched_artists = (
            db.query(dbi.dm.AudioFile)
            .filter(u(dbi.dm.AudioFile.artist).ilike(u(uq)))
            .all()
        )
        matched_albums = (
            db.query(dbi.dm.AudioFile)
            .filter(u(dbi.dm.AudioFile.album).ilike(u(uq)))
            .all()
        )
        matched_files = (
            db.query(dbi.dm.AudioFile)
            .filter(u(dbi.dm.AudioFile.local_path).ilike(u(uq)))
            .all()
        )

        all_audio_files = (
            matched_titles + matched_artists + matched_albums + matched_files
        )
        crate_ids = [file.crate_id for file in all_audio_files if file.crate_id]

        if crate_ids:
            crates_db = (
                db.query(dbi.dm.Crate)
                .filter(dbi.dm.Crate.id.in_(set(crate_ids)))
                .options(dbi.orm.joinedload(dbi.dm.Crate.parent))
                .all()
            )

            crate_map = {}
            for crate_item in crates_db:
                crate_with_images = dbi.dm.set_primary_images(crate_item)
                crate_map[crate_with_images.id] = crate_with_images

            for file in all_audio_files:
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

        if matched_titles:
            matched_titles.sort(key=lambda xx: len(xx.title))
            results.append(
                {
                    'kind': 'audio_files_by_title',
                    'name': 'Songs by Title',
                    'items': matched_titles,
                }
            )

        if matched_artists:
            matched_artists.sort(key=lambda xx: len(xx.title))
            results.append(
                {
                    'kind': 'audio_files_by_artist',
                    'name': 'Songs by Artist',
                    'items': matched_artists,
                }
            )

        if matched_albums:
            matched_albums.sort(key=lambda xx: len(xx.title))
            results.append(
                {
                    'kind': 'audio_files_by_album',
                    'name': 'Songs by Album',
                    'items': matched_albums,
                }
            )

        if matched_files:
            matched_files.sort(key=lambda xx: len(xx.title))
            results.append(
                {
                    'kind': 'audio_files_by_file_name',
                    'name': 'Songs by File Name',
                    'items': matched_files,
                }
            )

        playlists = (
            db.query(dbi.dm.Playlist).filter(u(dbi.dm.Playlist.name).ilike(u(uq))).all()
        )

        if playlists:
            playlists.sort(key=lambda xx: len(xx.name))
            results.append(
                {'kind': 'playlists', 'name': 'Playlists', 'items': playlists}
            )

    return results
