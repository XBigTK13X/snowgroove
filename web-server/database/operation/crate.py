from database.operation.db_internal import dbi
import database.operation.shelf as db_shelf

def create_crate(shelf_id: int, directory: str):
    with dbi.session() as db:
        shelf = db_shelf.get_shelf_by_id(shelf_id=shelf_id)
        relative_directory = directory.replace(shelf.local_path, "")

        path_parts = relative_directory.strip("/").split("/")

        current_relative_path = ""
        parent_id = None
        last_crate = None

        for part in path_parts:
            if not part:
                continue

            current_relative_path = dbi.os.path.join(current_relative_path, part)

            existing_crate = db.query(dbi.dm.Crate).filter_by(
                shelf_id=shelf_id,
                directory=current_relative_path
            ).first()

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

def get_crate_by_shelf_and_directory(shelf_id:int,directory:str,load_files:bool=True):
    with dbi.session() as db:
        query = (
            db.query(dbi.dm.Crate)
            .filter(
                dbi.dm.Crate.shelf_id == shelf_id,
                dbi.dm.Crate.directory == directory
            )
        )
        if load_files:
            query = (
                query
                .options(dbi.orm.joinedload(dbi.dm.Crate.audio_files))
                .options(dbi.orm.joinedload(dbi.dm.Crate.image_files))
                .options(dbi.orm.joinedload(dbi.dm.Crate.image_files))
                .options(dbi.orm.joinedload(dbi.dm.Crate.shelf))
                .options(dbi.orm.joinedload(dbi.dm.Crate.children))
            )
        return query.first()

def get_crate_list_by_shelf_id(shelf_id:int):
    with dbi.session() as db:
        return (
            db.query(dbi.dm.Crate)
            .filter(dbi.dm.Crate.shelf_id == shelf_id,dbi.dm.Crate.parent_crate_id == None)
            .options(dbi.orm.joinedload(dbi.dm.Crate.audio_files))
            .options(dbi.orm.joinedload(dbi.dm.Crate.image_files))
            .options(dbi.orm.joinedload(dbi.dm.Crate.metadata_files))
            .options(dbi.orm.joinedload(dbi.dm.Crate.shelf))
            .all()
        )

def model_to_dict(model_instance):
    if model_instance is None:
        return None

    result = {}
    for column in model_instance.__table__.columns:
        result[column.name] = getattr(model_instance, column.name)

    return result

def row_to_dict(row):
    # Convert Row object to a standard mutable dictionary
    data = dict(row)

    # Handle JSON string parsing if your driver doesn't auto-deserialize json_agg
    for key in ['image_files', 'audio_files', 'metadata_files', 'children']:
        if isinstance(data.get(key), str):
            data[key] = json.loads(data[key])
        elif data.get(key) is None:
            data[key] = []

    return data

def get_crate_by_id(crate_id:int):
    with dbi.session() as db:
        if search_query:
            search_query = search_query.replace("'","''")
        raw_query = f'''
        select
            crate.id as crate_id,
            crate.title as crate_title,

            shelf.id as shelf_id,
            shelf.name as shelf_name,

            (
                select json_agg(json_build_object(
                    'id', pi.id,
                    'local_path', pi.local_path,
                    'web_path', pi.web_path,
                    'kind', pi.kind,
                    'thumbnail_web_path', pi.thumbnail_web_path
                ))
                from image_file as pi
                where pi.crate_id = crate.id
            ) as image_files,

            (
                select json_agg(json_build_object(
                    'id', pa.id,
                    'kind', pa.kind,
                    'local_path', pa.local_path,
                    'network_path', pa.network_path,
                    'snowgroove_info_json', pa.snowgroove_info_json,
                    'version', pa.version
                ))
                from audio_file as pa
                where pa.crate_id = crate.id
            ) as audio_files,

            (
                select json_agg(json_build_object(
                    'id', pm.id,
                    'kind', pm.kind,
                    'local_path', pm.local_path,
                    'xml_content', pm.xml_content
                ))
                from metadata_file as pm
                where pm.crate_id = crate.id
            ) as metadata_files,

            (
                select json_agg(json_build_object(
                    'id', child.id,
                    'title', child.title,
                    'parent_crate_id', child.parent_crate_id,
                    'image_files', (
                        select json_agg(json_build_object(
                            'id', ci.id,
                            'local_path', ci.local_path,
                            'web_path', ci.web_path,
                            'kind', ci.kind,
                            'thumbnail_web_path', ci.thumbnail_web_path
                        ))
                        from image_file as ci
                        where ci.crate_id = child.id
                    )
                ) order by child.title)
                from crate as child
                where child.parent_crate_id = crate.id
            ) as children

        from crate as crate
        join crate_shelf as cs on cs.crate_id = crate.id
        join shelf as shelf on shelf.id = cs.shelf_id
        where crate.id = :crate_id
        '''

        result = db.execute(dbi.sql_text(raw_query), {"crate_id": crate_id}).mappings().first()

        if not result:
            return None

        crate = dict(result)

        # Ensure collections fallback to empty lists instead of None if no records exist
        for collection in ['image_files', 'audio_files', 'metadata_files', 'children']:
            if crate[collection] is None:
                crate[collection] = []

        for child in crate.children:
            child = db.dm.load_primary_images(child)

        return crate

def get_crate_by_id(crate_id:int):
    with dbi.session() as db:
        crate = (
            db.query(dbi.dm.Crate)
            .filter(dbi.dm.Crate.id == crate_id)
            .options(dbi.orm.joinedload(dbi.dm.Crate.audio_files))
            .options(dbi.orm.joinedload(dbi.dm.Crate.image_files))
            .options(dbi.orm.joinedload(dbi.dm.Crate.metadata_files))
            .options(dbi.orm.joinedload(dbi.dm.Crate.shelf))
            .options(
                dbi.orm.selectinload(dbi.dm.Crate.children)
                .options(dbi.orm.selectinload(dbi.dm.Crate.image_files))
            )
            .first()
        )
        if crate:
            crate = dbi.dm.set_primary_images(crate)
            crate.children.sort(key=lambda xx: xx.title)
            for child in crate.children:
                child = dbi.dm.set_primary_images(child)
        return crate

def get_crate_list_by_directory(directory:str,load_files:bool=True):
    with dbi.session() as db:
        query = (
            db.query(dbi.dm.Crate)
            .filter(dbi.dm.Crate.directory.contains(directory))
        )
        if load_files:
            query = (
                query
                .options(dbi.orm.joinedload(dbi.dm.Crate.audio_files))
                .options(dbi.orm.joinedload(dbi.dm.Crate.image_files))
                .options(dbi.orm.joinedload(dbi.dm.Crate.shelf))
            )
        return query.order_by(
            dbi.func.length(dbi.dm.Crate.directory),
            dbi.dm.Crate.directory
        ).all()

def get_crate_subdirectories(directory: str):
    with dbi.session() as db:
        return (
            db.query(dbi.dm.Crate.directory)
            .filter(dbi.dm.Crate.directory.contains(directory))
            .all()
        )

def get_crate_list(search_query: str):

    with dbi.session() as db:
        u = dbi.func.unaccent
        uq = u(f'%{search_query}%')

        directories = (
            db.query(dbi.dm.Crate)
                .options(dbi.orm.joinedload(dbi.dm.Crate.shelf))
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
                xx.display = xx.directory.replace(xx.shelf.local_path+'/','')

        return {
            'directories': directories,
            'images': images,
            'videos': videos
        }