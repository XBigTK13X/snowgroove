import json
import urllib.parse
from log import log
import pychromecast
from pychromecast.models import CastInfo
from pychromecast.discovery import HostServiceInfo


def scan_remote_players():
    log.info('Starting remote player scan...')
    devices, browser = pychromecast.get_chromecasts()
    pychromecast.discovery.stop_discovery(browser)

    remote_players = []

    for device in devices:
        network_payload = {
            'host': device.cast_info.host,
            'port': device.cast_info.port,
            'uuid': str(device.cast_info.uuid),
            'cast_type': device.cast_info.cast_type,
        }

        remote_player = {
            'kind': 'chromecast',
            'device_make': device.cast_info.model_name,
            'name': device.cast_info.friendly_name,
            'connection_info_json': json.dumps(network_payload),
        }
        remote_players.append(remote_player)

    log.info(f'Scan complete. Found {len(remote_players)} players.')
    return remote_players


def act(remote_player, remote_action, music_session):
    connection_info = json.loads(remote_player.connection_info_json)
    current_audio_file = music_session.music_queue['songs'][
        music_session.music_queue['current_song_index']
    ]

    if remote_action == 'play':
        play(connection_info=connection_info, audio_file=current_audio_file)
    else:
        cast_info = CastInfo(
            services={
                HostServiceInfo(
                    host=connection_info['host'], port=connection_info['port']
                )
            },
            uuid=connection_info['uuid'],
            model_name=None,
            friendly_name=None,
            host=connection_info['host'],
            port=connection_info['port'],
            cast_type=connection_info['cast_type'],
            manufacturer=None,
        )
        cast_device = pychromecast.Chromecast(cast_info=cast_info)
        cast_device.wait()

        media_controller = cast_device.media_controller

        if cast_device.app_id:
            try:
                media_controller.block_until_active(timeout=2.0)
                media_controller.update_status()
            except pychromecast.error.PyChromecastError:
                pass

        current_state = media_controller.status.player_state

        has_active_session = current_state not in (None, 'UNKNOWN', 'IDLE')

        if remote_action == 'pause':
            if has_active_session:
                media_controller.pause()
        elif remote_action == 'stop':
            if has_active_session:
                media_controller.stop()
        elif remote_action == 'next':
            play(connection_info=connection_info, audio_file=current_audio_file)
        elif remote_action == 'previous':
            play(connection_info=connection_info, audio_file=current_audio_file)
        elif remote_action.startswith('seek--'):
            if has_active_session:
                seek_target = remote_action.split('seek--')[-1]
                if seek_target.isdigit():
                    seek_seconds = int(seek_target)
                    media_controller.seek(seek_seconds)
        elif remote_action.startswith('volume--'):
            volume_target = remote_action.split('volume--')[-1]
            if volume_target.isdigit():
                volume_percent = int(volume_target)
                if 0 <= volume_percent <= 100:
                    cast_device.set_volume(volume_percent / 100.0)


def play(connection_info, audio_file):
    audio_url = audio_file['web_path']
    device_ip = connection_info['host']

    def encode_url(url):
        parts = list(urllib.parse.urlparse(url))
        parts[2] = urllib.parse.quote(parts[2])
        return urllib.parse.urlunparse(parts)

    encoded_audio_url = encode_url(audio_url)
    cover_art_url = (
        encode_url(audio_file['thumbnail_web_path'])
        if audio_file.get('thumbnail_web_path')
        else None
    )

    title = audio_file.get('title', 'Unknown Title')
    artist = audio_file.get('artist', 'Unknown Artist')
    album = audio_file.get('album', 'Unknown Album')

    cast_info = CastInfo(
        services={HostServiceInfo(host=device_ip, port=connection_info['port'])},
        uuid=connection_info['uuid'],
        model_name=None,
        friendly_name=None,
        host=device_ip,
        port=connection_info['port'],
        cast_type=connection_info['cast_type'],
        manufacturer=None,
    )

    cast_device = pychromecast.Chromecast(cast_info=cast_info)
    cast_device.wait()

    media_controller = cast_device.media_controller

    if cast_device.app_id:
        try:
            media_controller.block_until_active(timeout=2.0)
            media_controller.update_status()

            if media_controller.is_active:
                status = media_controller.status
                if (
                    status.content_id == encoded_audio_url
                    and status.player_state == 'PAUSED'
                ):
                    media_controller.play()
                    return
        except pychromecast.error.PyChromecastError:
            pass

    media_metadata = {
        'metadataType': 3,
        'title': title,
        'artist': artist,
        'albumName': album,
        'images': [{'url': cover_art_url, 'width': 600, 'height': 600}]
        if cover_art_url
        else [],
    }

    media_controller.play_media(
        url=encoded_audio_url,
        content_type='audio/mpeg',
        title=title,
        thumb=cover_art_url,
        metadata=media_metadata,
        stream_type='BUFFERED',
    )

    try:
        media_controller.block_until_active(timeout=5.0)
        media_controller.update_status()
    except pychromecast.error.PyChromecastError:
        pass
