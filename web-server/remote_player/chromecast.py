import json
import urllib.parse
from log import log
from settings import config
import pychromecast
from pychromecast.models import CastInfo
from pychromecast.discovery import HostServiceInfo
import threading
import uuid

_cast_cache = {}
_cache_lock = threading.Lock()


class TrackCompletionListener:
    def __init__(self, cast_device, on_finished_callback):
        self.cast_device = cast_device
        self.on_finished_callback = on_finished_callback
        self._was_playing = False
        if config.debug_remote_players:
            log.info(
                f'[Chromecast-DEBUG] TrackCompletionListener initialized for cast target UUID: {cast_device.cast_info.uuid}'
            )

    def new_media_status(self, status):
        if status.player_state == 'PLAYING':
            self._was_playing = True

        if (
            self._was_playing
            and status.player_state in ('IDLE', 'UNKNOWN')
            and status.idle_reason == 'FINISHED'
        ):
            self._was_playing = False
            self.on_finished_callback()

    def new_cast_status(self, status):
        pass


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
            if config.debug_remote_players:
                log.info(
                    '[Chromecast-DEBUG] Requesting cast client from shared cache layer...'
                )
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

    cast_device = pychromecast.Chromecast(cast_info=cast_info)
    cast_device.wait()

    return cast_device


def attach_listener(connection_info, on_track_finished):
    if not on_track_finished:
        return

    try:
        cast_device = _get_cached_cast(connection_info, force_refresh=False)
        if not cast_device:
            return

        media_controller = cast_device.media_controller
        if cast_device.app_id:
            try:
                media_controller.block_until_active(timeout=2.0)
                media_controller.update_status()
            except pychromecast.error.PyChromecastError:
                pass

        if config.debug_remote_players:
            log.info(
                f'[Chromecast-DEBUG] Re-attaching track completion listener for cast target UUID: {cast_device.cast_info.uuid}'
            )

        media_controller._status_listeners = []
        listener = TrackCompletionListener(cast_device, on_track_finished)
        media_controller.register_status_listener(listener)
    except Exception as error_message:
        log.error(
            f'Failed to re-attach Chromecast completion listener: {error_message}'
        )


def act(remote_player, remote_action, music_session):
    connection_info = json.loads(remote_player.connection_info_json)

    if remote_action in ['play', 'next', 'previous']:
        current_audio_file = music_session.music_queue['songs'][
            music_session.music_queue['current_song_index']
        ]
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
            volume_level = float(volume_target)
            if 0.0 <= volume_level <= 1.0:
                scaled_volume = volume_level * 0.7
                cast_device.set_volume(scaled_volume)
    except Exception as error_message:
        log.error(
            f'Failed to execute action {remote_action} on {remote_player.name}: {error_message}'
        )


def play(connection_info, audio_file, on_track_finished=None):
    audio_url = audio_file['web_path']

    def encode_url(url):
        if not url:
            return url
        parsed_url = urllib.parse.urlparse(url)
        full_path = parsed_url.path
        if parsed_url.fragment:
            full_path = f'{full_path}#{parsed_url.fragment}'
        quoted_path = urllib.parse.quote(full_path, safe='/')
        return urllib.parse.urlunparse(
            (
                parsed_url.scheme,
                parsed_url.netloc,
                quoted_path,
                parsed_url.params,
                parsed_url.query,
                '',
            )
        )

    encoded_audio_url = encode_url(audio_url)
    cover_art_url = (
        encode_url(audio_file['thumbnail_web_path'])
        if audio_file.get('thumbnail_web_path')
        else None
    )

    title = audio_file.get('title', 'Unknown Title')
    artist = audio_file.get('artist', 'Unknown Artist')
    album = audio_file.get('album', 'Unknown Album')

    if config.debug_remote_players:
        log.info(
            f'[Chromecast-DEBUG] Play invocation initiated. Target IP: {connection_info["host"]}'
        )
        log.info(
            f'[Chromecast-DEBUG] Payload resolved -> title: "{title}", url: "{encoded_audio_url}"'
        )

    try:
        cast_device = _get_cached_cast(connection_info, force_refresh=False)
        if not cast_device:
            return

        try:
            cast_device.set_volume_muted(False)
        except Exception as mute_err:
            log.warning(f'Failed to un-mute Chromecast target device: {mute_err}')

        if cast_device.app_id == pychromecast.config.APP_MEDIA_RECEIVER:
            try:
                cast_device.media_controller.update_status()
                status = cast_device.media_controller.status
                if status.content_id == encoded_audio_url and status.player_state in (
                    'PLAYING',
                    'BUFFERING',
                ):
                    if config.debug_remote_players:
                        log.info(
                            '[Chromecast-DEBUG] Target file is already active on device. Updating tracking listener and skipping redundant initialization.'
                        )
                    if on_track_finished:
                        cast_device.media_controller._status_listeners = []
                        listener = TrackCompletionListener(
                            cast_device, on_track_finished
                        )
                        cast_device.media_controller.register_status_listener(listener)
                    return
            except Exception:
                pass

        if config.debug_remote_players:
            log.info(
                f'[Chromecast-DEBUG] Acquired cast connection. Initializing Default Media Receiver application (App ID: {pychromecast.config.APP_MEDIA_RECEIVER})'
            )
        cast_device.start_app(pychromecast.config.APP_MEDIA_RECEIVER)
        media_controller = cast_device.media_controller

        try:
            if config.debug_remote_players:
                log.info(
                    '[Chromecast-DEBUG] Blocking thread until media controller channel is active...'
                )
            media_controller.block_until_active(timeout=5.0)
            media_controller.update_status()

            if media_controller.is_active:
                status = media_controller.status
                if config.debug_remote_players:
                    log.info(
                        f'[Chromecast-DEBUG] Media channel verified active. Existing app player state: {status.player_state}'
                    )
                if (
                    status.content_id == encoded_audio_url
                    and status.player_state == 'PAUSED'
                ):
                    if on_track_finished:
                        media_controller._status_listeners = []
                        listener = TrackCompletionListener(
                            cast_device, on_track_finished
                        )
                        media_controller.register_status_listener(listener)
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

        if on_track_finished:
            if config.debug_remote_players:
                log.info(
                    '[Chromecast-DEBUG] Registering push event listener class onto hardware media controller channel.'
                )
            media_controller._status_listeners = []
            listener = TrackCompletionListener(cast_device, on_track_finished)
            media_controller.register_status_listener(listener)

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
        except pychromecast.error.PyChromecastError as block_err:
            log.error(
                f'Post-play media controller active block failed to resolve: {block_err}'
            )
    except Exception as error_message:
        log.error(f'Play routine failed with exception: {error_message}')


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
