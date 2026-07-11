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


def get_crate_list_by_shelf_id(ticket: dbi.dm.Ticket, shelf_id: int):
    with dbi.session() as db:
        if ticket and ticket.has_tag_restrictions():
            base_query = db.query(
                dbi.dm.Crate.id,
                dbi.dm.Crate.parent_crate_id,
                dbi.sa.literal(1).label('depth'),
            ).filter(
                dbi.dm.Crate.shelf_id == shelf_id, dbi.dm.Crate.parent_crate_id == None
            )

            crate_cte = base_query.cte(name='crate_tree', recursive=True)

            child_crate = dbi.orm.aliased(dbi.dm.Crate, name='child_crate')
            crate_cte = crate_cte.union_all(
                db.query(
                    child_crate.id,
                    child_crate.parent_crate_id,
                    (crate_cte.c.depth + 1).label('depth'),
                ).join(child_crate, child_crate.parent_crate_id == crate_cte.c.id)
            )

            tagged_crates = (
                db.query(
                    crate_cte.c.id.label('crate_id'), crate_cte.c.depth.label('depth')
                )
                .join(dbi.dm.Crate, dbi.dm.Crate.id == crate_cte.c.id)
                .join(dbi.dm.Crate.tags)
                .filter(dbi.dm.Tag.id.in_(ticket.tag_ids))
                .subquery()
            )

            ancestor_cte = db.query(
                tagged_crates.c.crate_id.label('target_id'),
                tagged_crates.c.crate_id.label('ancestor_id'),
            ).cte(name='ancestor_tree', recursive=True)

            parent_lookup = dbi.orm.aliased(dbi.dm.Crate, name='parent_lookup')
            ancestor_cte = ancestor_cte.union_all(
                db.query(
                    ancestor_cte.c.target_id,
                    parent_lookup.parent_crate_id.label('ancestor_id'),
                )
                .join(parent_lookup, parent_lookup.id == ancestor_cte.c.ancestor_id)
                .filter(parent_lookup.parent_crate_id != None)
            )

            branch_mapping = (
                db.query(
                    ancestor_cte.c.target_id.label('crate_id'),
                    ancestor_cte.c.ancestor_id.label('root_id'),
                )
                .join(dbi.dm.Crate, dbi.dm.Crate.id == ancestor_cte.c.ancestor_id)
                .filter(dbi.dm.Crate.parent_crate_id == None)
                .subquery()
            )

            min_depth_per_branch = (
                db.query(
                    branch_mapping.c.root_id,
                    dbi.sa.func.min(tagged_crates.c.depth).label('min_depth'),
                )
                .join(
                    tagged_crates, tagged_crates.c.crate_id == branch_mapping.c.crate_id
                )
                .group_by(branch_mapping.c.root_id)
                .subquery()
            )

            allowed_crate_ids = [
                row.crate_id
                for row in db.query(tagged_crates.c.crate_id)
                .join(
                    branch_mapping,
                    branch_mapping.c.crate_id == tagged_crates.c.crate_id,
                )
                .join(
                    min_depth_per_branch,
                    min_depth_per_branch.c.root_id == branch_mapping.c.root_id,
                )
                .filter(tagged_crates.c.depth == min_depth_per_branch.c.min_depth)
                .all()
            ]

            if not allowed_crate_ids:
                return []

            base_filter = dbi.dm.Crate.id.in_(allowed_crate_ids)
        else:
            base_filter = dbi.sa.and_(
                dbi.dm.Crate.shelf_id == shelf_id, dbi.dm.Crate.parent_crate_id == None
            )

        return (
            db.query(dbi.dm.Crate)
            .filter(base_filter)
            .options(dbi.orm.joinedload(dbi.dm.Crate.audio_files))
            .options(dbi.orm.joinedload(dbi.dm.Crate.image_files))
            .options(dbi.orm.joinedload(dbi.dm.Crate.metadata_files))
            .options(dbi.orm.joinedload(dbi.dm.Crate.shelf))
            .options(dbi.orm.joinedload(dbi.dm.Crate.tags))
            .order_by(dbi.dm.Crate.title)
            .all()
        )


def get_crate_by_id(ticket: dbi.dm.Ticket, crate_id: int):
    tags = get_tags_for_crate(crate_id=crate_id)
    if ticket:
        if ticket.has_tag_restrictions():
            if not ticket.is_allowed(tag_ids=[xx.id for xx in tags]):
                return None
    with dbi.session() as db:
        crate = (
            db.query(dbi.dm.Crate)
            .filter(dbi.dm.Crate.id == crate_id)
            .options(dbi.orm.joinedload(dbi.dm.Crate.audio_files))
            .options(dbi.orm.joinedload(dbi.dm.Crate.image_files))
            .options(dbi.orm.joinedload(dbi.dm.Crate.metadata_files))
            .options(dbi.orm.joinedload(dbi.dm.Crate.shelf))
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

                audio_file.album_crate_id = crate.id
                audio_file.artist_crate_id = (
                    crate.parent_crate_id if crate.parent_crate_id else None
                )
            crate.audio_files.sort(key=lambda xx: (xx.disc or 0, xx.track or 0))
        crate.active_tags = tags
        return crate


def get_tags_for_crate(crate_id: int):
    with dbi.session() as db:
        crate_cte = (
            db.query(dbi.dm.Crate.id, dbi.dm.Crate.parent_crate_id)
            .filter(dbi.dm.Crate.id == crate_id)
            .cte(name='crate_tree', recursive=True)
        )

        parent_crate = dbi.orm.aliased(dbi.dm.Crate, name='parent_crate')

        crate_cte = crate_cte.union_all(
            db.query(parent_crate.id, parent_crate.parent_crate_id).join(
                crate_cte, parent_crate.id == crate_cte.c.parent_crate_id
            )
        )

        tags = (
            db.query(dbi.dm.Tag)
            .join(dbi.dm.Crate.tags)
            .join(crate_cte, dbi.dm.Crate.id == crate_cte.c.id)
            .all()
        )
        return tags


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

        if directories:
            for xx in directories:
                xx.display = xx.directory.replace(xx.shelf.local_path + '/', '')

        return {'directories': directories}


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
                audio_file.album_crate_id = crate.id
                audio_file.artist_crate_id = (
                    crate.parent_crate_id if crate.parent_crate_id else None
                )
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
