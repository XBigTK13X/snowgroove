import json
import urllib.parse
from log import log
import pychromecast
from pychromecast.models import CastInfo
from pychromecast.discovery import HostServiceInfo
import threading
import uuid

_cast_cache = {}
_cache_lock = threading.Lock()


def scan_remote_players():
    log.info('Starting remote player scan...')
    devices, browser = pychromecast.get_chromecasts()
    browser.stop_discovery()

    remote_players = []
    for device in devices:
        network_payload = {
            'host': device.cast_info.host,
            'port': device.cast_info.port,
            'uuid': str(device.cast_info.uuid),
            'cast_type': device.cast_info.cast_type,
            'model_name': device.cast_info.model_name,
            'friendly_name': device.cast_info.friendly_name,
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


def _get_cached_cast(connection_info, force_refresh=False):
    player_uuid = connection_info.get('uuid')
    if not player_uuid:
        return None

    with _cache_lock:
        cast_device = _cast_cache.get(player_uuid)

        if cast_device and not force_refresh:
            if cast_device.socket_client and cast_device.socket_client.is_connected:
                return cast_device
            else:
                try:
                    cast_device.disconnect()
                except Exception:
                    pass
                _cast_cache.pop(player_uuid, None)

        if cast_device and force_refresh:
            try:
                cast_device.disconnect()
            except Exception:
                pass
            _cast_cache.pop(player_uuid, None)

        try:
            cast_device = _connect(connection_info)
        except Exception as connection_error:
            log.warning(
                f'Direct connection to host {connection_info["host"]} failed: {connection_error}'
            )
            raise connection_error

        _cast_cache[player_uuid] = cast_device
        return cast_device


def _connect(connection_info):
    device_ip = str(connection_info['host'])
    device_port = int(connection_info.get('port', 8009))

    cast_info = CastInfo(
        services={HostServiceInfo(host=device_ip, port=device_port)},
        uuid=uuid.UUID(connection_info['uuid'])
        if connection_info.get('uuid')
        else None,
        model_name=connection_info.get('model_name'),
        friendly_name=connection_info.get('friendly_name'),
        host=device_ip,
        port=device_port,
        cast_type=connection_info.get('cast_type', 'cast'),
        manufacturer=None,
    )

    log.info(f'Initiating connection to Chromecast at {device_ip}:{device_port}...')
    cast_device = pychromecast.Chromecast(cast_info=cast_info)
    cast_device.wait()

    try:
        if cast_device.socket_client and cast_device.socket_client._socket:
            local_address = cast_device.socket_client._socket.getsockname()
            log.info(
                f'Chromecast connection established. Local socket bound to: {local_address[0]} on port {local_address[1]}'
            )
        else:
            log.warning(
                'Chromecast client connected, but the underlying socket wrapper descriptor is missing.'
            )
    except Exception as socket_error:
        log.warning(f'Failed to read local socket interface bindings: {socket_error}')

    return cast_device


def act(remote_player, remote_action, music_session):
    connection_info = json.loads(remote_player.connection_info_json)
    current_audio_file = music_session.music_queue['songs'][
        music_session.music_queue['current_song_index']
    ]

    if remote_action in ['play', 'next', 'previous']:
        play(connection_info=connection_info, audio_file=current_audio_file)
        return

    try:
        cast_device = _get_cached_cast(connection_info)
        if not cast_device:
            return

        media_controller = cast_device.media_controller

        if cast_device.app_id:
            try:
                media_controller.block_until_active(timeout=2.0)
                media_controller.update_status()
            except pychromecast.error.PyChromecastError as block_err:
                log.warning(f'Action controller initialization timed out: {block_err}')

        current_state = media_controller.status.player_state
        has_active_session = current_state not in (None, 'UNKNOWN', 'IDLE')

        if remote_action == 'pause':
            if has_active_session:
                media_controller.pause()
        elif remote_action == 'stop':
            if has_active_session:
                media_controller.stop()
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
    except Exception as error_message:
        log.error(
            f'Failed to execute action {remote_action} on {remote_player.name}: {error_message}'
        )


def play(connection_info, audio_file):
    audio_url = audio_file['web_path']

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

    try:
        cast_device = _get_cached_cast(connection_info, force_refresh=False)
        if not cast_device:
            return

        log.info(
            f'Requesting Default Media Receiver app initialization (App ID: {pychromecast.config.APP_MEDIA_RECEIVER})'
        )
        cast_device.start_app(pychromecast.config.APP_MEDIA_RECEIVER)
        media_controller = cast_device.media_controller

        try:
            media_controller.block_until_active(timeout=5.0)
            media_controller.update_status()

            if media_controller.is_active:
                status = media_controller.status
                if (
                    status.content_id == encoded_audio_url
                    and status.player_state == 'PAUSED'
                ):
                    log.info(
                        'Detected matching paused stream session. Resuming playback.'
                    )
                    media_controller.play()
                    return
        except pychromecast.error.PyChromecastError as block_err:
            log.warning(
                f'Pre-play media controller active block timed out/failed: {block_err}'
            )

        media_metadata = {
            'metadataType': 3,
            'title': title,
            'artist': artist,
            'albumName': album,
            'images': [{'url': cover_art_url, 'width': 600, 'height': 600}]
            if cover_art_url
            else [],
        }

        log.info(
            f'Dispatching play_media command to Chromecast. Target Resource URL: {encoded_audio_url}'
        )
        media_controller.play_media(
            url=encoded_audio_url,
            content_type='audio/mpeg',
            title=title,
            thumb=cover_art_url,
            metadata=media_metadata,
            stream_type='BUFFERED',
        )

        try:
            log.info(
                'Awaiting post-play confirmation and media channel sync from device...'
            )
            media_controller.block_until_active(timeout=5.0)
            media_controller.update_status()
            log.info(
                f'Post-play synchronization finished. Current reported device state: {media_controller.status.player_state}'
            )
        except pychromecast.error.PyChromecastError as block_err:
            log.error(
                f'Post-play media controller active block failed to resolve: {block_err}'
            )
    except Exception as error_message:
        log.error(f'Play routine failed: {error_message}')


def get_status(remote_player):
    try:
        connection_info = json.loads(remote_player.connection_info_json)
        cast_device = _get_cached_cast(connection_info)
        if not cast_device:
            return {'position_seconds': 0, 'is_playing': False}

        media_controller = cast_device.media_controller

        if cast_device.app_id:
            try:
                media_controller.block_until_active(timeout=2.0)
                media_controller.update_status()
            except pychromecast.error.PyChromecastError:
                pass

        status = media_controller.status
        player_state = status.player_state

        position_seconds = (
            int(status.current_time) if status.current_time is not None else 0
        )
        is_playing = player_state == 'PLAYING'

        return {'position_seconds': position_seconds, 'is_playing': is_playing}
    except Exception as error_message:
        player_uuid = connection_info.get('uuid')
        if player_uuid:
            with _cache_lock:
                _cast_cache.pop(player_uuid, None)

        log.error(
            f'Failed to fetch status from Chromecast device {remote_player.name}: {error_message}'
        )
        return {'position_seconds': 0, 'is_playing': False}
