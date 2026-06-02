from database.operation.db_internal import dbi
import snow_media.audio
import database.operation.crate as db_crate

def create_audio_file(
    crate_id: int,
    file_info:dict,
    snowgroove_info_json: str,
    ffprobe_raw_json:str,
    mediainfo_raw_json:str
    ):
    crate = db_crate.get_crate_by_id(crate_id=crate_id)
    network_path = ''
    local_path = file_info['file_path']
    if crate.shelf.network_path:
        network_path = local_path.replace(crate.shelf.local_path,crate.shelf.network_path)
    web_path = dbi.config.web_media_url + local_path
    file_name = dbi.os.path.basename(local_path)
    snowgroove_info = dbi.json.loads(snowgroove_info_json)
    local_thumbnail_path = snow_media.image.create_thumbnail(local_path)
    thumbnail_web_path = dbi.config.web_media_url + local_thumbnail_path
    if local_thumbnail_path[0] != '/':
        thumbnail_web_path = dbi.config.web_media_url + '/' + local_thumbnail_path

    with dbi.session() as db:
        dbm = dbi.dm.AudioFile()
        dbm.crate_id = crate_id
        dbm.album = file_info['album']
        dbm.artist = file_info['artist']
        dbm.disc = file_info['disc']
        dbm.duration = float(snowgroove_info['duration_seconds'])
        dbm.ffprobe_raw_json = ffprobe_raw_json
        dbm.fingerprint = file_info['fingerprint']
        dbm.kind = file_info['kind']
        dbm.local_path = local_path
        dbm.mediainfo_raw_json = mediainfo_raw_json
        dbm.network_path = network_path
        dbm.position = file_info['position']
        dbm.snowgroove_info_json = snowgroove_info_json
        dbm.title = file_info['title']
        dbm.thumbnail_web_path = thumbnail_web_path
        dbm.track = file_info['track']
        dbm.web_path = web_path
        dbm.year = file_info['year']
        db.add(dbm)
        db.commit()
        db.refresh(dbm)
        return dbm


def get_audio_file_by_path(local_path: str):
    with dbi.session() as db:
        return (
            db.query(dbi.dm.AudioFile)
            .filter(dbi.dm.AudioFile.local_path == local_path)
            .first()
        )

def get_or_create_audio_file(crate_id: int, file_info:dict):
    audio_file = get_audio_file_by_path(local_path=file_info['file_path'])
    if not audio_file:
        info = snow_media.audio.path_to_info_json(media_path=file_info['file_path'])
        return create_audio_file(
            crate_id=crate_id,
            file_info=file_info,
            snowgroove_info_json=info['snowgroove_info'],
            ffprobe_raw_json=info['ffprobe_raw'],
            mediainfo_raw_json=info['mediainfo_raw']
        )

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