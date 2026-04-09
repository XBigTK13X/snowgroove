from database.operation.db_internal import dbi
import json

def create_crate(directory: str):
    with dbi.session() as db:
        dbm = dbi.dm.Crate()
        dbm.directory = directory
        db.add(dbm)
        db.commit()
        db.refresh(dbm)
        return dbm

def add_crate_to_shelf(crate_id: int, shelf_id: int):
    with dbi.session() as db:
        dbm = dbi.dm.CrateShelf()
        dbm.shelf_id = shelf_id
        dbm.crate_id = crate_id
        db.add(dbm)
        db.commit()
        db.refresh(dbm)
        return dbm

def get_crate_by_directory(directory:str,load_files:bool=True):
    with dbi.session() as db:
        query = (
            db.query(dbi.dm.Crate)
            .filter(dbi.dm.Crate.directory == directory)
        )
        if load_files:
            query = (
                query
                .options(dbi.orm.joinedload(dbi.dm.Crate.video_files))
                .options(dbi.orm.joinedload(dbi.dm.Crate.image_files))
                .options(dbi.orm.joinedload(dbi.dm.Crate.shelf))
            )
        return query.first()

def get_crate_by_id(crate_id:int):
    with dbi.session() as db:
        return (
            db.query(dbi.dm.Crate)
            .filter(dbi.dm.Crate.id == crate_id)
            .options(dbi.orm.joinedload(dbi.dm.Crate.video_files))
            .options(dbi.orm.joinedload(dbi.dm.Crate.image_files))
            .options(dbi.orm.joinedload(dbi.dm.Crate.shelf))
            .first()
        )

def get_crate_list_by_directory(directory:str,load_files:bool=True):
    with dbi.session() as db:
        query = (
            db.query(dbi.dm.Crate)
            .filter(dbi.dm.Crate.directory.contains(directory))
        )
        if load_files:
            query = (
                query
                .options(dbi.orm.joinedload(dbi.dm.Crate.video_files))
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

def create_crate_video_file(crate_id: int, video_file_id: int):
    with dbi.session() as db:
        dbm = dbi.dm.CrateVideoFile()
        dbm.crate_id = crate_id
        dbm.video_file_id = video_file_id
        db.add(dbm)
        db.commit()
        db.refresh(dbm)
        return dbm

def get_crate_video_file(crate_id: int, video_file_id: int):
    with dbi.session() as db:
        return (
            db.query(dbi.dm.CrateVideoFile)
            .filter(dbi.dm.CrateVideoFile.crate_id == crate_id)
            .filter(dbi.dm.CrateVideoFile.video_file_id == video_file_id)
            .first()
        )

def create_crate_image_file(crate_id: int, image_file_id: int):
    with dbi.session() as db:
        dbm = dbi.dm.CrateImageFile()
        dbm.crate_id = crate_id
        dbm.image_file_id = image_file_id
        db.add(dbm)
        db.commit()
        db.refresh(dbm)
        return dbm

def get_crate_image_file(crate_id: int, image_file_id: int):
    with dbi.session() as db:
        return (
            db.query(dbi.dm.CrateImageFile)
            .filter(dbi.dm.CrateImageFile.crate_id == crate_id)
            .filter(dbi.dm.CrateImageFile.image_file_id == image_file_id)
            .first()
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

        if videos:
            for xx in videos:
                xx.thumbnail_web_path = xx.video_file.thumbnail_web_path
                xx.name = xx.video_file.name
                xx.model_kind = 'crate_video'
                xx.video_file.info = json.loads(xx.video_file.snowstream_info_json)

        return {
            'directories': directories,
            'images': images,
            'videos': videos
        }