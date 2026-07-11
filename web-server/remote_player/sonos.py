import time
import urllib
import json
import soco
from db import db
from log import log
import urllib.parse
from soco.data_structures import DidlMusicTrack, DidlResource
import xml.etree.ElementTree as ET


def scan_remote_players():
    zone_players = soco.discover()

    remote_players = []

    if not zone_players:
        return remote_players

    for player in zone_players:
        device_info = player.get_current_track_info()
        speaker_info = player.get_speaker_info()

        model_name = speaker_info.get('model_name', 'Sonos Player')
        friendly_name = player.player_name

        network_payload = {
            'host': player.ip_address,
            'uid': player.uid,
            'is_visible': player.is_visible,
        }

        remote_player = {
            'kind': 'sonos',
            'device_make': model_name,
            'name': friendly_name,
            'connection_info_json': json.dumps(network_payload),
        }
        remote_players.append(remote_player)

    return remote_players


def act(remote_player, remote_action, music_session):
    connection_info = json.loads(remote_player.connection_info_json)
    sonos_player = soco.SoCo(connection_info['host'])

    if (
        remote_action == 'play'
        or remote_action == 'next'
        or remote_action == 'previous'
    ):
        current_audio_file = music_session.music_queue['songs'][
            music_session.music_queue['current_song_index']
        ]
        play(device_ip=connection_info['host'], audio_file=current_audio_file)
    elif remote_action == 'pause':
        sonos_player.pause()
    elif remote_action == 'stop':
        sonos_player.stop()
    elif remote_action.startswith('seek--'):
        seek_target = remote_action.split('seek--')[-1]
        if seek_target.isdigit():
            seek_seconds = int(seek_target)
            formatted_time = time.strftime('%H:%M:%S', time.gmtime(seek_seconds))
            sonos_player.seek(formatted_time)
    elif remote_action.startswith('volume--'):
        volume_target = remote_action.split('volume--')[-1]
        if volume_target.isdigit():
            volume_percent = int(volume_target)
            if 0 <= volume_percent <= 100:
                sonos_player.volume = volume_percent


def play(device_ip, audio_file):
    audio_url = audio_file['web_path']

    def encode_url(url):
        parts = list(urllib.parse.urlparse(url))
        parts[2] = urllib.parse.quote(parts[2])
        return urllib.parse.urlunparse(parts)

    encoded_audio_url = encode_url(audio_url)
    cover_art_url = (
        encode_url(audio_file['thumbnail_web_path'])
        if audio_file.get('thumbnail_web_path')
        else ''
    )

    title = audio_file.get('title', 'Unknown Title')
    artist = audio_file.get('artist', 'Unknown Artist')
    album = audio_file.get('album', 'Unknown Album')

    sonos_player = soco.SoCo(device_ip)

    current_track = sonos_player.get_current_track_info()
    transport_info = sonos_player.get_current_transport_info()

    if (
        current_track.get('uri') == encoded_audio_url
        and transport_info.get('current_transport_state') == 'PAUSED_PLAYBACK'
    ):
        sonos_player.play()
        return

    meta_xml = (
        '<DIDL-Lite xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/"'
        ' xmlns:dc="http://purl.org/dc/elements/1.1/"'
        ' xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/">'
        '<item id="-1" parentID="-1" restricted="true">'
        f'<dc:title>{title}</dc:title>'
        f'<dc:creator>{artist}</dc:creator>'
        f'<upnp:artist>{artist}</upnp:artist>'
        f'<upnp:album>{album}</upnp:album>'
        + (
            f'<upnp:albumArtURI>{cover_art_url}</upnp:albumArtURI>'
            if cover_art_url
            else ''
        )
        + f'<upnp:class>object.item.audioItem.musicTrack</upnp:class>'
        f'<res protocolInfo="http-get:*:audio/mpeg:*">{encoded_audio_url}</res>'
        '</item>'
        '</DIDL-Lite>'
    )

    sonos_player.clear_queue()
    sonos_player.add_uri_to_queue(encoded_audio_url, meta=meta_xml)
    sonos_player.play_from_queue(0)


def get_status(remote_player):
    connection_info = json.loads(remote_player.connection_info_json)
    sonos_player = soco.SoCo(connection_info['host'])

    try:
        track_info = sonos_player.get_current_track_info()
        transport_info = sonos_player.get_current_transport_info()

        # Convert HH:MM:SS string to total seconds
        position_str = track_info.get('position', '0:00:00')
        parts = position_str.split(':')
        position_seconds = 0
        if len(parts) == 3:
            position_seconds = int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
        elif len(parts) == 2:
            position_seconds = int(parts[0]) * 60 + int(parts[1])

        current_state = transport_info.get('current_transport_state', 'STOPPED')
        is_playing = current_state == 'PLAYING'

        return {'position_seconds': position_seconds, 'is_playing': is_playing}
    except soco.exceptions.SoCoUPnPException as upnp_error:
        if (
            upnp_error.error_code == '711'
            or getattr(upnp_error, 'error_code', None) == 711
        ):
            return {'position_seconds': 0, 'is_playing': False}

        log.error(f'UPnP error from Sonos device {remote_player.name}: {upnp_error}')
        return {'position_seconds': 0, 'is_playing': False}
    except Exception as error_message:
        error_str = str(error_message)
        if '711' in error_str or 'Illegal seek target' in error_str:
            return {'position_seconds': 0, 'is_playing': False}

        log.error(
            f'Failed to fetch status from Sonos device {remote_player.name}: {error_message}'
        )
        return {'position_seconds': 0, 'is_playing': False}
