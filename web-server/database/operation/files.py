from database.operation.db_internal import dbi
from database.operation import db_crate


def purge_missing_audio_file_records():
    deleted_records = []
    with dbi.session() as db:
        audio_files = db.query(dbi.dm.AudioFile).all()
        for audio_file in audio_files:
            if not dbi.os.path.exists(audio_file.local_path):
                deleted_records.append(audio_file.local_path)
                db.query(dbi.dm.AudioFile).filter(
                    dbi.dm.AudioFile.id == audio_file.id
                ).delete()
        db.commit()
    return deleted_records


def purge_missing_image_file_records():
    deleted_records = []
    with dbi.session() as db:
        image_files = db.query(dbi.dm.ImageFile).all()
        for image_file in image_files:
            if not dbi.os.path.exists(image_file.local_path):
                deleted_records.append(image_file.local_path)
                db.query(dbi.dm.ImageFile).filter(
                    dbi.dm.ImageFile.id == image_file.id
                ).delete()
        db.commit()
    return deleted_records


def purge_missing_metadata_file_records():
    deleted_records = []
    with dbi.session() as db:
        metadata_files = db.query(dbi.dm.MetadataFile).all()
        for metadata_file in metadata_files:
            if not dbi.os.path.exists(metadata_file.local_path):
                deleted_records.append(metadata_file.local_path)
                db.query(dbi.dm.MetadataFile).filter(
                    dbi.dm.MetadataFile.id == metadata_file.id
                ).delete()
        db.commit()
    return deleted_records


def purge_shelf_content_without_audio_files():
    results = []
    with dbi.session() as db:
        while True:
            empty_crates = (
                db.query(dbi.dm.Crate)
                .filter(
                    ~dbi.dm.Crate.audio_files.any(),
                    ~dbi.dm.Crate.image_files.any(),
                    ~dbi.dm.Crate.metadata_files.any(),
                    ~dbi.dm.Crate.children.any(),
                )
                .all()
            )

            if not empty_crates:
                break

            for crate in empty_crates:
                results.append(f'crate - {crate.id} - {crate.directory}')

            crate_ids = [crate.id for crate in empty_crates]
            db.query(dbi.dm.Crate).filter(dbi.dm.Crate.id.in_(crate_ids)).delete(
                synchronize_session=False
            )

            db.commit()

    return results


def purge_orphaned_records():
    results = []
    with dbi.session() as db:
        file_kinds = ['audio_file', 'image_file', 'metadata_file']
        for kind in file_kinds:
            file_query = f"""
                select
                    {kind}.id as file_id
                from {kind}
                    left join crate on crate.id = {kind}.crate_id
                where
                    crate.id is null;
            """
            cursor = db.execute(dbi.sql_text(file_query))
            file_ids = []
            for row in cursor:
                results.append(f'{kind} - {row.file_id}')
                file_ids.append(str(row.file_id))
            if file_ids:
                group = ','.join(file_ids)
                db.execute(
                    dbi.sql_text(f'delete from {kind} where {kind}.id in ({group});')
                )
                db.commit()

        crate_query = """
            select
                crate.id as crate_id
            from crate
                left join shelf on shelf.id = crate.shelf_id
            where
                shelf.id is null;
        """
        crate_cursor = db.execute(dbi.sql_text(crate_query))
        crate_ids = []
        for row in crate_cursor:
            results.append(f'crate - {row.crate_id}')
            crate_ids.append(str(row.crate_id))
        if crate_ids:
            group = ','.join(crate_ids)
            db.execute(dbi.sql_text(f'delete from crate where crate.id in ({group});'))
            db.commit()

        album_query = """
            select
                album.id as album_id
            from album
                left join crate on crate.id = album.crate_id
            where
                crate.id is null;
        """
        album_cursor = db.execute(dbi.sql_text(album_query))
        album_ids = []
        for row in album_cursor:
            results.append(f'album - {row.album_id}')
            album_ids.append(str(row.album_id))
        if album_ids:
            group = ','.join(album_ids)
            db.execute(dbi.sql_text(f'delete from album where album.id in ({group});'))
            db.commit()

        crate_artist_query = """
            select
                crate_artist.crate_id as crate_id,
                crate_artist.artist_id as artist_id
            from crate_artist
                left join crate on crate.id = crate_artist.crate_id
                left join artist on artist.id = crate_artist.artist_id
            where
                crate.id is null
                or artist.id is null;
        """
        crate_artist_cursor = db.execute(dbi.sql_text(crate_artist_query))
        for row in crate_artist_cursor:
            results.append(
                f'crate_artist - crate:{row.crate_id} artist:{row.artist_id}'
            )
            db.execute(
                dbi.sql_text(
                    f'delete from crate_artist where crate_id = {row.crate_id} and artist_id = {row.artist_id};'
                )
            )
        db.commit()

        artist_query = """
            select
                artist.id as artist_id
            from artist
                left join crate_artist on crate_artist.artist_id = artist.id
            where
                crate_artist.artist_id is null;
        """
        artist_cursor = db.execute(dbi.sql_text(artist_query))
        artist_ids = []
        for row in artist_cursor:
            results.append(f'artist - {row.artist_id}')
            artist_ids.append(str(row.artist_id))
        if artist_ids:
            group = ','.join(artist_ids)
            db.execute(
                dbi.sql_text(f'delete from artist where artist.id in ({group});')
            )
            db.commit()

    return results
