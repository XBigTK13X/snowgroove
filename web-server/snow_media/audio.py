import util
from log import log
import json
from settings import config
import traceback
import math

def fail_track_parse(exception, media_path, ffprobe=None, mediainfo=None):
    log.error(f"An error occurred while reading track info for [{media_path}]")
    log.error(f"{exception}\n {traceback.format_exc()}")
    if ffprobe:
        log.error('ffprobe')
        log.error(json.dumps(ffprobe, indent=4))
    if mediainfo:
        log.error('mediainfo')
        log.error(json.dumps(mediainfo, indent=4))
    raise exception

class MediaTrack:
    # mediainfo index is 1 based
    # ffprobe index is 0 based
    # mpv uses ffprobe index scheme
    def __init__(self, media_path: str, ffprobe:dict, mediainfo:dict, is_anime:bool=False):
        try:
            self.kind = None
            self.audio_tags = {}
            if mediainfo != None and 'CodecID' in mediainfo:
                self.codec = mediainfo['CodecID']
            elif 'codec_name' in ffprobe:
                self.codec = ffprobe['codec_name']
            if mediainfo != None and 'Format' in mediainfo:
                self.format = mediainfo['Format']
            else:
                self.format = ffprobe['codec_name']
            if mediainfo != None:
                if 'StreamSize' in mediainfo:
                    self.bit_size = int(mediainfo['StreamSize'])
                if 'BitRate' in mediainfo:
                    if '/' in mediainfo['BitRate']:
                        self.bit_rate = int(mediainfo['BitRate'].split('/')[0])
                    else:
                        self.bit_rate = int(mediainfo['BitRate'])
                if 'BitRate_Mode' in mediainfo:
                    self.bit_rate_kind = mediainfo['BitRate_Mode']

                self.title = f"{mediainfo['Title']}" if mediainfo and 'Title' in mediainfo else ''

            if ffprobe['codec_type'] == 'video':
                self.read_video(ffprobe, mediainfo)
            elif ffprobe['codec_type'] == 'audio':
                self.read_audio(ffprobe, mediainfo, is_anime)
        except Exception as e:
            fail_track_parse(e,media_path,ffprobe,mediainfo)

    def read_audio(self, ffprobe, mediainfo, is_anime):
        if mediainfo == None:
            return
        self.kind = 'audio'
        self.audio_index = 0
        if '@typeorder' in mediainfo:
            self.audio_index = int(mediainfo['@typeorder'])-1
        if 'Format_Commercial_IfAny' in mediainfo:
            self.format_full = mediainfo['Format_Commercial_IfAny']
        if 'Channels' in mediainfo:
            self.channel_count = int(mediainfo['Channels'])
        if 'Compression_Mode' in mediainfo:
            self.is_lossless = mediainfo['Compression_Mode'] == 'Lossless'
        if 'format' in ffprobe and 'tags' in ffprobe['format']:
            self.audio_tags = ffprobe['format']['tags']

def path_to_info_json(media_path: str, ffprobe_json:str = None, mediainfo_json:str=None):
    probe = get_snowgroove_info(
        media_path,
        ffprobe_existing=ffprobe_json,
        mediainfo_existing=mediainfo_json
    )
    return {
        'mediainfo_raw': json.dumps(probe['mediainfo_raw']),
        'ffprobe_raw': json.dumps(probe['ffprobe_raw']),
        'snowgroove_info': json.dumps(probe['snowgroove_info'])
    }


def get_snowgroove_info(media_path:str,ffprobe_existing:str=None,mediainfo_existing:str=None):
    raw_ffprobe = None
    safe_media_path = util.safe_media_path(media_path)
    if ffprobe_existing:
        raw_ffprobe = json.loads(ffprobe_existing)
    else:
        command = f"ffprobe -hide_banner -loglevel quiet {safe_media_path} -print_format json -show_format -show_streams"
        #log.info(command)
        command_output = util.run_cli(command,raw_output=True)
        if 'failed' in command_output:
            log.error(f'Failed to get ffprobe for [{media_path}]')
            log.error('result')
            log.error(command_output['result'])
            log.error('stdout')
            log.error(command_output['stdout'])
            log.error('stderr')
            log.error(command_output['stderr'])
            raise Exception(f"Unable to ffprobe media info for [{media_path}]")
        ffprobe_output = command_output['stdout']
        cleaned_ffprobe = ffprobe_output.replace("�",'')
        raw_ffprobe = json.loads(cleaned_ffprobe)

    raw_mediainfo = None
    if mediainfo_existing:
        raw_mediainfo = json.loads(mediainfo_existing)
    else:
        command = f"mediainfo --ParseSpeed={config.mediainfo_parse_speed} --Output=JSON {safe_media_path}"
        #log.info(command)
        command_output = util.run_cli(command,raw_output=True)
        mediainfo_output = command_output['stdout']
        raw_mediainfo = json.loads(mediainfo_output)

    snowgroove_info = {
        'duration_seconds': float(raw_ffprobe.get('format',{}).get('duration',0)),
        'audio_track':{}
    }

    valid_stream_kinds = ['audio','video','subtitle']
    ff_track = None
    for ff in raw_ffprobe['streams']:
        try:
            if not ff['codec_type'] in valid_stream_kinds:
                continue
            ff_track = ff
            break
        except Exception as e:
            fail_track_parse(e,media_path,ff)

    valid_mis = ['Audio']
    mi_track = None
    for mi in raw_mediainfo['media']['track']:
        try:
            if not mi['@type'] in valid_mis:
                continue
            if '' in mi and mi[''] == None:
                continue
            mi_track = mi
            break
        except Exception as e:
            fail_track_parse(e,media_path,None,mi)

    try:
        track = MediaTrack(
            media_path=media_path,
            ffprobe=ff_track,
            mediainfo=mi_track
        )
        snowgroove_info['audio_track'] = track.__dict__
    except Exception as e:
        log.error(f'stream key error {safe_media_path}')
        log.error(json.dumps(ff_track, indent=4))
        log.error(json.dumps(mi_track, indent=4))
        fail_track_parse(
            exception=e,
            media_path=media_path,
            ffprobe=ff_track,
            mediainfo=mi_track
        )

    result = {
        'snowgroove_info': snowgroove_info,
        'ffprobe_raw': raw_ffprobe,
        'mediainfo_raw': raw_mediainfo
    }
    return result

def scrub_container_info(local_path:str):
    safe_media_path = util.safe_media_path(local_path)
    command = f"mkvpropedit {safe_media_path} --edit info --set title=''"
    util.run_cli(command,raw_output=True)
    return True