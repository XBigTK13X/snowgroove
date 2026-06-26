from database.operation.db_internal import dbi
import database.operation.shelf as db_shelf


def create_crate(shelf_id: int, directory: str):
    with dbi.session() as db:
        shelf = db_shelf.get_shelf_by_id(shelf_id=shelf_id)
        relative_directory = directory.replace(shelf.local_path, '')

        path_parts = relative_directory.strip('/').split('/')

        current_relative_path = ''
        parent_id = None
        last_crate = None

        for part in path_parts:
            if not part:
                continue

            current_relative_path = dbi.os.path.join(current_relative_path, part)

            existing_crate = (
                db.query(dbi.dm.Crate)
                .filter(
                    dbi.dm.Crate.shelf_id == shelf_id,
                    dbi.dm.Crate.directory == current_relative_path,
                )
                .first()
            )

            if existing_crate:
                last_crate = existing_crate
                parent_id = existing_crate.id
                continue

            dbm = dbi.dm.Crate()
            dbm.shelf_id = shelf_id
            dbm.directory = current_relative_path
            dbm.title = part

            if parent_id is not None:
                dbm.parent_crate_id = parent_id

            db.add(dbm)
            db.commit()
            db.refresh(dbm)

            parent_id = dbm.id
            last_crate = dbm

        return last_crate


def get_crate_by_shelf_and_directory(
    shelf_id: int, directory: str, load_files: bool = True
):
    with dbi.session() as db:
        query = db.query(dbi.dm.Crate).filter(
            dbi.dm.Crate.shelf_id == shelf_id, dbi.dm.Crate.directory == directory
        )
        if load_files:
            query = (
                query.options(dbi.orm.joinedload(dbi.dm.Crate.audio_files))
                .options(dbi.orm.joinedload(dbi.dm.Crate.image_files))
                .options(dbi.orm.joinedload(dbi.dm.Crate.metadata_files))
                .options(dbi.orm.joinedload(dbi.dm.Crate.shelf))
                .options(dbi.orm.joinedload(dbi.dm.Crate.children))
            )
        return query.first()


def get_crate_list_by_shelf_id(shelf_id: int):
    with dbi.session() as db:
        return (
            db.query(dbi.dm.Crate)
            .filter(
                dbi.dm.Crate.shelf_id == shelf_id, dbi.dm.Crate.parent_crate_id == None
            )
            .options(dbi.orm.joinedload(dbi.dm.Crate.audio_files))
            .options(dbi.orm.joinedload(dbi.dm.Crate.image_files))
            .options(dbi.orm.joinedload(dbi.dm.Crate.metadata_files))
            .options(dbi.orm.joinedload(dbi.dm.Crate.shelf))
            .options(dbi.orm.joinedload(dbi.dm.Crate.tags))
            .order_by(dbi.dm.Crate.title)
            .all()
        )


def get_crate_by_id(crate_id: int):
    with dbi.session() as db:
        crate = (
            db.query(dbi.dm.Crate)
            .filter(dbi.dm.Crate.id == crate_id)
            .options(dbi.orm.joinedload(dbi.dm.Crate.audio_files))
            .options(dbi.orm.joinedload(dbi.dm.Crate.image_files))
            .options(dbi.orm.joinedload(dbi.dm.Crate.metadata_files))
            .options(dbi.orm.joinedload(dbi.dm.Crate.shelf))
            .options(dbi.orm.joinedload(dbi.dm.Crate.tags))
            .options(
                dbi.orm.selectinload(dbi.dm.Crate.children).options(
                    dbi.orm.selectinload(dbi.dm.Crate.image_files)
                )
            )
            .first()
        )
        if crate:
            crate = dbi.dm.set_primary_images(crate)
            crate.children.sort(key=lambda xx: xx.title)
            crate.kind = 'crate'
            for child in crate.children:
                child = dbi.dm.set_primary_images(child)
                if child.album_cover_image_url != None and crate.kind == 'crate':
                    crate.kind = 'artist'
            for audio_file in crate.audio_files:
                if not audio_file.thumbnail_web_path:
                    audio_file.thumbnail_web_path = crate.album_cover_image_url
                if crate.kind != 'album':
                    crate.kind = 'album'
            crate.audio_files.sort(key=lambda xx: (xx.disc or 0, xx.track or 0))
        return crate


def get_crate_list(search_query: str):

    with dbi.session() as db:
        u = dbi.func.unaccent
        uq = u(f'%{search_query}%')

        directories = (
            db.query(dbi.dm.Crate)
            .options(dbi.orm.joinedload(dbi.dm.Crate.shelf))
            .options(dbi.orm.joinedload(dbi.dm.Crate.tags))
            .filter(u(dbi.dm.Crate.directory).ilike(uq))
            .all()
        )
        images = (
            db.query(dbi.dm.CrateImageFile)
            .join(dbi.dm.CrateImageFile.image_file)
            .filter(u(dbi.dm.ImageFile.local_path).ilike(uq))
            .options(dbi.orm.contains_eager(dbi.dm.CrateImageFile.image_file))
            .all()
        )
        videos = (
            db.query(dbi.dm.CrateVideoFile)
            .join(dbi.dm.CrateVideoFile.video_file)
            .filter(u(dbi.dm.VideoFile.local_path).ilike(uq))
            .options(dbi.orm.contains_eager(dbi.dm.CrateVideoFile.video_file))
            .all()
        )

        if directories:
            for xx in directories:
                xx.display = xx.directory.replace(xx.shelf.local_path + '/', '')

        return {'directories': directories, 'images': images, 'videos': videos}


def get_crate_audio_file_list(crate_id: int):
    with dbi.session() as db:
        crate_cte = (
            dbi.sa.select(dbi.dm.Crate.id, dbi.dm.Crate.parent_crate_id)
            .filter(dbi.dm.Crate.id == crate_id)
            .cte(name='crate_tree', recursive=True)
        )

        recursive_select = dbi.sa.select(
            dbi.dm.Crate.id, dbi.dm.Crate.parent_crate_id
        ).join(crate_cte, dbi.dm.Crate.parent_crate_id == crate_cte.c.id)

        crate_cte = crate_cte.union_all(recursive_select)

        crates = (
            db.query(dbi.dm.Crate)
            .filter(dbi.dm.Crate.id.in_(dbi.sa.select(crate_cte.c.id)))
            .options(dbi.orm.joinedload(dbi.dm.Crate.audio_files))
            .options(dbi.orm.joinedload(dbi.dm.Crate.image_files))
            .options(dbi.orm.joinedload(dbi.dm.Crate.tags))
            .all()
        )

        flat_audio_files = []

        for crate in crates:
            crate = dbi.dm.set_primary_images(crate)

            for audio_file in crate.audio_files:
                if not audio_file.thumbnail_web_path:
                    audio_file.thumbnail_web_path = crate.album_cover_image_url

                audio_file.crate_title = crate.title
                flat_audio_files.append(audio_file)

        flat_audio_files.sort(
            key=lambda xx: (xx.crate_title or '', xx.disc or 0, xx.track or 0)
        )

        return {'audio_files': flat_audio_files}


def get_crate_tag(crate_id: int, tag_id: int):
    with dbi.session() as db:
        return (
            db.query(dbi.dm.CrateTag)
            .filter(
                dbi.dm.CrateTag.crate_id == crate_id, dbi.dm.CrateTag.tag_id == tag_id
            )
            .first()
        )


def create_crate_tag(crate_id: int, tag_id: int):
    with dbi.session() as db:
        dbm = dbi.dm.CrateTag()
        dbm.crate_id = crate_id
        dbm.tag_id = tag_id

        db.add(dbm)
        db.commit()
        db.refresh(dbm)
