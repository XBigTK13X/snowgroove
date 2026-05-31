from database.operation.db_internal import dbi
import snow_media.audio
import database.operation.crate as db_crate

def create_audio_file(
    crate_id: int,
    kind: str,
    local_path: str,
    snowgroove_info_json: str,
    ffprobe_raw_json:str,
    mediainfo_raw_json:str
    ):
    crate = db_crate.get_crate_by_id(crate_id=crate_id)
    network_path = ''
    if crate.network_path:
        network_path = local_path.replace(crate.local_path,crate.network_path)
    web_path = dbi.config.web_media_url + local_path
    file_name = dbi.os.path.basename(local_path)
    with dbi.session() as db:
        dbm = dbi.dm.AudioFile()
        dbm.crate_id = crate_id
        dbm.local_path = local_path
        dbm.web_path = web_path
        dbm.network_path = network_path
        dbm.kind = kind
        dbm.snowgroove_info_json = snowgroove_info_json
        dbm.ffprobe_raw_json = ffprobe_raw_json
        dbm.mediainfo_raw_json = mediainfo_raw_json
        dbm.name = dbi.os.path.splitext(file_name)[0]
        db.add(dbm)
        db.commit()
        db.refresh(dbm)
        return dbm


def get_audio_file_by_path(local_path: str):
    with dbi.session() as db:
        return db.query(dbi.dm.AudioFile).filter(dbi.dm.AudioFile.local_path == local_path).first()

def get_or_create_audio_file(crate_id: int, kind: str, local_path: str):
    audio_file = get_audio_file_by_path(local_path=local_path)
    if not audio_file:
        try:
            info = snow_media.audio.path_to_info_json(media_path=local_path)
            return create_audio_file(
                crate_id=crate_id,
                kind=kind,
                local_path=local_path,
                snowgroove_info_json=info['snowstream_info'],
                ffprobe_raw_json=info['ffprobe_raw'],
                mediainfo_raw_json=info['mediainfo_raw']
            )
        except Exception as e:
            return None

    return audio_file

def update_audio_file_info(
    audio_file_id:int,
    snowgroove_info_json:str,
    ffprobe_json:str=None,
    mediainfo_json:str=None
):
    with dbi.session() as db:
        audio_file = db.query(dbi.dm.AudioFile).filter(dbi.dm.AudioFile.id == audio_file_id).first()
        audio_file.snowgroove_info_json = snowgroove_info_json
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