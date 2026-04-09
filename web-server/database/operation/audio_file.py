from database.operation.db_internal import dbi
import snow_media.video
import database.operation.shelf as db_shelf

def create_audio_file(
    shelf_id: int,
    kind: str,
    local_path: str,
    snowstream_info_json: str,
    ffprobe_raw_json:str,
    mediainfo_raw_json:str
    ):
    shelf = db_shelf.get_shelf_by_id(shelf_id=shelf_id)
    network_path = ''
    if shelf.network_path:
        network_path = local_path.replace(shelf.local_path,shelf.network_path)
    web_path = dbi.config.web_media_url + local_path
    version = None
    file_name = dbi.os.path.basename(local_path)
    if '[' in file_name and ']' in file_name:
        version = file_name.split('[')[-1].split(']')[0]
    with dbi.session() as db:
        dbm = dbi.dm.AudioFile()
        dbm.local_path = local_path
        dbm.web_path = web_path
        dbm.network_path = network_path
        dbm.kind = kind
        dbm.shelf_id = shelf_id
        dbm.snowstream_info_json = snowstream_info_json
        dbm.ffprobe_raw_json = ffprobe_raw_json
        dbm.mediainfo_raw_json = mediainfo_raw_json
        dbm.version = version
        dbm.name = dbi.os.path.splitext(file_name)[0]
        db.add(dbm)
        db.commit()
        db.refresh(dbm)
        return dbm


def get_audio_file_by_path(local_path: str):
    with dbi.session() as db:
        return db.query(dbi.dm.AudioFile).filter(dbi.dm.AudioFile.local_path == local_path).first()

def get_or_create_audio_file(shelf_id: int, kind: str, local_path: str):
    audio_file = get_audio_file_by_path(local_path=local_path)
    if not audio_file:
        try:
            info = snow_media.video.path_to_info_json(media_path=local_path)
            return create_audio_file(
                shelf_id=shelf_id,
                kind=kind,
                local_path=local_path,
                snowstream_info_json=info['snowstream_info'],
                ffprobe_raw_json=info['ffprobe_raw'],
                mediainfo_raw_json=info['mediainfo_raw']
            )
        except Exception as e:
            return None

    return audio_file

def update_audio_file_info(
    audio_file_id:int,
    snowstream_info_json:str,
    ffprobe_json:str=None,
    mediainfo_json:str=None
):
    with dbi.session() as db:
        audio_file = db.query(dbi.dm.AudioFile).filter(dbi.dm.AudioFile.id == audio_file_id).first()
        audio_file.snowstream_info_json = snowstream_info_json
        if ffprobe_json:
            audio_file.ffprobe_raw_json = ffprobe_json
        if mediainfo_json:
            audio_file.mediainfo_raw_json = mediainfo_json
        db.commit()
        return audio_file

def update_audio_file_thumbnail(audio_file_id:int,thumbnail_web_path:str):
    with dbi.session() as db:
        (
            db.query(dbi.dm.AudioFile)
            .filter(dbi.dm.AudioFile.id == audio_file_id)
            .update({
                'thumbnail_web_path': thumbnail_web_path
            })
        )
        db.commit()
        return True

def get_audio_file_by_id(audio_file_id: int):
    with dbi.session() as db:
        return db.query(dbi.dm.AudioFile).filter(dbi.dm.AudioFile.id == audio_file_id).first()

def get_audio_files_by_shelf(shelf_id: int):
    with dbi.session() as db:
        return db.query(dbi.dm.AudioFile).filter(dbi.dm.AudioFile.shelf_id == shelf_id).all()

def get_audio_file_list(directory:str=None):
    with dbi.session() as db:
        query = db.query(dbi.dm.AudioFile)

        if directory:
            query = query.filter(dbi.dm.AudioFile.local_path.contains(directory))

        query = (query
            .order_by(dbi.dm.AudioFile.local_path)
            .all()
        )

        return query