import util
from log import log
import json
from settings import config
import traceback
import math


def fail_track_parse(exception, media_path, ffprobe=None):
    log.error(f'An error occurred while reading track info for [{media_path}]')
    log.error(f'{exception}\n {traceback.format_exc()}')
    if ffprobe:
        log.error('ffprobe')
        log.error(json.dumps(ffprobe, indent=4))
    raise exception


class MediaTrack:
    # ffprobe index is 0 based
    # mpv uses ffprobe index scheme
    def __init__(self, media_path: str, ffprobe: dict, is_anime: bool = False):
        try:
            self.kind = None
            self.audio_tags = {}
            self.codec = ffprobe.get('codec_name')
            self.format = ffprobe.get('codec_name')

            if 'bit_rate' in ffprobe:
                self.bit_rate = int(ffprobe['bit_rate'])
            elif 'tags' in ffprobe and 'BPS' in ffprobe['tags']:
                self.bit_rate = int(ffprobe['tags']['BPS'])
            else:
                self.bit_rate = None

            self.bit_size = None
            if 'tags' in ffprobe and 'NUMBER_OF_BYTES' in ffprobe['tags']:
                self.bit_size = int(ffprobe['tags']['NUMBER_OF_BYTES'])
            elif self.bit_rate and 'duration' in ffprobe:
                self.bit_size = int((self.bit_rate * float(ffprobe['duration'])) / 8)

            self.title = ''
            if 'tags' in ffprobe and 'title' in ffprobe['tags']:
                self.title = ffprobe['tags']['title']
            elif (
                'format' in ffprobe
                and 'tags' in ffprobe['format']
                and 'title' in ffprobe['format']['tags']
            ):
                self.title = ffprobe['format']['tags']['title']

            if ffprobe['codec_type'] == 'video':
                self.read_video(ffprobe)
            elif ffprobe['codec_type'] == 'audio':
                self.read_audio(ffprobe, is_anime)
        except Exception as e:
            fail_track_parse(e, media_path, ffprobe)

    def read_audio(self, ffprobe, is_anime):
        self.kind = 'audio'
        self.audio_index = ffprobe.get('index', 0)
        self.format_full = ffprobe.get('codec_long_name')
        self.channel_count = ffprobe.get('channels')

        lossless_codecs = {'flac', 'alac', 'truehd', 'dts-hd', 'pcm_s16le', 'pcm_s24le'}
        self.is_lossless = self.codec in lossless_codecs

        if 'tags' in ffprobe:
            self.audio_tags = ffprobe['tags']


def path_to_info_json(media_path: str, ffprobe_json: str = None):
    probe = get_snowgroove_info(media_path, ffprobe_existing=ffprobe_json)
    return {
        'ffprobe_raw': json.dumps(probe['ffprobe_raw']),
        'snowgroove_info': json.dumps(probe['snowgroove_info']),
    }


def get_snowgroove_info(media_path: str, ffprobe_existing: str = None):
    raw_ffprobe = None
    safe_media_path = util.safe_media_path(media_path)
    if ffprobe_existing:
        raw_ffprobe = json.loads(ffprobe_existing)
    else:
        command = f'ffprobe -hide_banner -loglevel quiet {safe_media_path} -print_format json -show_format -show_streams'
        # log.info(command)
        command_output = util.run_cli(command, raw_output=True)
        if 'failed' in command_output:
            log.error(f'Failed to get ffprobe for [{media_path}]')
            log.error('result')
            log.error(command_output['result'])
            log.error('stdout')
            log.error(command_output['stdout'])
            log.error('stderr')
            log.error(command_output['stderr'])
            raise Exception(f'Unable to ffprobe media info for [{media_path}]')
        ffprobe_output = command_output['stdout']
        cleaned_ffprobe = ffprobe_output.replace('�', '')
        raw_ffprobe = json.loads(cleaned_ffprobe)

    snowgroove_info = {
        'duration_seconds': float(raw_ffprobe.get('format', {}).get('duration', 0)),
        'audio_track': {},
    }

    valid_stream_kinds = ['audio', 'video', 'subtitle']
    ff_track = None
    for ff in raw_ffprobe['streams']:
        try:
            if not ff['codec_type'] in valid_stream_kinds:
                continue
            ff_track = ff
            break
        except Exception as e:
            fail_track_parse(e, media_path, ff)

    try:
        track = MediaTrack(media_path=media_path, ffprobe=ff_track)
        snowgroove_info['audio_track'] = track.__dict__
    except Exception as e:
        log.error(f'stream key error {safe_media_path}')
        log.error(json.dumps(ff_track, indent=4))
        fail_track_parse(exception=e, media_path=media_path, ffprobe=ff_track)

    result = {'snowgroove_info': snowgroove_info, 'ffprobe_raw': raw_ffprobe}
    return result


def scrub_container_info(local_path: str):
    safe_media_path = util.safe_media_path(local_path)
    command = f"mkvpropedit {safe_media_path} --edit info --set title=''"
    util.run_cli(command, raw_output=True)
    return True
