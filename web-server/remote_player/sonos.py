import time
import urllib.parse
import json
import soco
import threading
import queue
from db import db
from log import log
from settings import config
import html

_active_subscriptions = {}


def _log_debug(message):
    if getattr(config, 'debug_remote_players', False):
        log.info(f'[Sonos-DEBUG] {message}')


class SonosTrackCompletionListener:
    def __init__(self, sonos_player, on_finished_callback):
        self.sonos_player = sonos_player
        self.on_finished_callback = on_finished_callback
        self._was_playing = False
        self.subscription = None
        self._event_thread = None
        self._poll_thread = None
        self._running = False
        self._initial_track_uri = None
        self._last_pos_sec = 0
        _log_debug(
            f'SonosTrackCompletionListener provisioned for speaker UID: {sonos_player.uid}'
        )

    def start(self, subscription):
        self.subscription = subscription
        self._running = True

        try:
            current_info = self.sonos_player.get_current_track_info()
            self._initial_track_uri = current_info.get('uri')

            transport_info = self.sonos_player.get_current_transport_info()
            if transport_info.get('current_transport_state') == 'PLAYING':
                self._was_playing = True
        except Exception:
            self._initial_track_uri = None

        self._event_thread = threading.Thread(target=self._event_loop, daemon=True)
        self._event_thread.start()

        self._poll_thread = threading.Thread(target=self._poll_loop, daemon=True)
        self._poll_thread.start()

    def _parse_seconds(self, time_str):
        if not time_str or not isinstance(time_str, str):
            return 0
        parts = time_str.split(':')
        try:
            if len(parts) == 3:
                return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
            elif len(parts) == 2:
                return int(parts[0]) * 60 + int(parts[1])
        except ValueError:
            return 0
        return 0

    def _check_completion(self):
        try:
            track_info = self.sonos_player.get_current_track_info()
            transport_info = self.sonos_player.get_current_transport_info()
            state = transport_info.get('current_transport_state')

            pos_sec = self._parse_seconds(track_info.get('position'))
            dur_sec = self._parse_seconds(track_info.get('duration'))
            current_uri = track_info.get('uri')

            _log_debug(
                f'[Sonos-Check] State: {state}, Pos: {pos_sec}/{dur_sec}, LastPos: {self._last_pos_sec}, WasPlaying: {self._was_playing}'
            )

            if state == 'PLAYING':
                self._was_playing = True

            has_advanced = (
                self._initial_track_uri
                and current_uri
                and current_uri != self._initial_track_uri
            )
            has_stopped = self._was_playing and state == 'STOPPED'

            # Track finished if position reached end and state stopped/changed, OR position wrapped back to 0 after being near the end
            pos_wrapped_around = (
                self._was_playing
                and dur_sec > 0
                and self._last_pos_sec >= (dur_sec - 3)
                and pos_sec <= 2
            )
            has_finished = (
                self._was_playing
                and dur_sec > 0
                and pos_sec >= (dur_sec - 1)
                and state != 'PLAYING'
            )

            self._last_pos_sec = pos_sec

            if has_advanced or has_stopped or has_finished or pos_wrapped_around:
                _log_debug(
                    f'Sonos end-of-track verified (Stopped: {has_stopped}, Advanced: {has_advanced}, Finished: {has_finished}, Wrapped: {pos_wrapped_around}). Triggering next hook.'
                )
                self._was_playing = False
                self._running = False
                threading.Thread(target=self._trigger_completion, daemon=True).start()
                return True
        except Exception as check_err:
            _log_debug(f'Error during completion check: {check_err}')
        return False

    def _event_loop(self):
        _log_debug(f'Sonos event listener thread started for {self.sonos_player.uid}')
        while self._running and self.subscription:
            try:
                event = self.subscription.events.get(timeout=0.5)
                transport_state = event.variables.get('current_transport_state')
                _log_debug(
                    f'Inbound UPnP AVTransport event received -> State: {transport_state}. Was playing flag: {self._was_playing}'
                )
                if transport_state == 'PLAYING':
                    self._was_playing = True

                if self._check_completion():
                    break
            except queue.Empty:
                continue
            except Exception as loop_err:
                _log_debug(f'Exception inside Sonos event listener loop: {loop_err}')
                break

    def _poll_loop(self):
        _log_debug(f'Sonos polling thread started for {self.sonos_player.uid}')
        while self._running:
            time.sleep(1.0)
            if not self._running:
                break
            if self._was_playing:
                if self._check_completion():
                    break

    def _trigger_completion(self):
        self.unsubscribe()
        self.on_finished_callback()

    def unsubscribe(self):
        self._running = False
        _log_debug(
            f'Tearing down active UPnP subscription for Sonos client: {self.sonos_player.uid}'
        )
        if self.subscription:
            try:
                self.subscription.unsubscribe()
            except Exception as unsub_err:
                _log_debug(f'Gracefully ignored unsubscription exception: {unsub_err}')
            self.subscription = None
        _active_subscriptions.pop(self.sonos_player.uid, None)


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

    if remote_action == 'pause':
        uid = connection_info.get('uid')
        if uid in _active_subscriptions:
            _active_subscriptions[uid].unsubscribe()
        sonos_player.pause()
    elif remote_action == 'stop':
        uid = connection_info.get('uid')
        if uid in _active_subscriptions:
            _active_subscriptions[uid].unsubscribe()
        sonos_player.stop()
    elif remote_action.startswith('seek--'):
        seek_target = remote_action.split('seek--')[-1]
        if seek_target.isdigit():
            seek_seconds = int(seek_target)
            formatted_time = time.strftime('%H:%M:%S', time.gmtime(seek_seconds))
            sonos_player.seek(formatted_time)
    elif remote_action.startswith('volume--'):
        volume_target = remote_action.split('volume--')[-1]
        volume_level = float(volume_target)
        if 0.0 <= volume_level <= 1.0:
            sonos_player.volume = volume_level * 100


def attach_listener(device_ip, on_track_finished, device_uid=None):
    if not on_track_finished:
        return

    sonos_player = soco.SoCo(device_ip)
    uid = device_uid or sonos_player.uid

    if uid in _active_subscriptions:
        _active_subscriptions[uid].unsubscribe()

    try:
        _log_debug(f'Re-attaching UPnP event listener for restored speaker {uid}...')
        listener = SonosTrackCompletionListener(sonos_player, on_track_finished)
        sub = sonos_player.avTransport.subscribe()
        listener.start(sub)
        _active_subscriptions[uid] = listener
    except Exception as err:
        log.error(f'Failed to re-attach Sonos completion listener: {err}')


def play(device_ip, audio_file, on_track_finished=None, device_uid=None):
    _log_debug(f'Play invocation initiated. Sonos target IP: {device_ip}')
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
        else ''
    )

    title = html.escape(audio_file.get('title', 'Unknown Title'))
    artist = html.escape(audio_file.get('artist', 'Unknown Artist'))
    album = html.escape(audio_file.get('album', 'Unknown Album'))
    escaped_audio_url = html.escape(encoded_audio_url)
    escaped_cover_art_url = html.escape(cover_art_url) if cover_art_url else ''

    sonos_player = soco.SoCo(device_ip)

    uid = device_uid or sonos_player.uid
    _log_debug(f'Resolved player unique identification hash: {uid}')

    if uid in _active_subscriptions:
        _log_debug(
            'Stale active UPnP subscription mapping discovered for this unit. Purging old connection.'
        )
        _active_subscriptions[uid].unsubscribe()

    try:
        current_track = sonos_player.get_current_track_info()
        transport_info = sonos_player.get_current_transport_info()
        _log_debug(
            f'Current internal state -> URI: {current_track.get("uri")}, State: {transport_info.get("current_transport_state")}'
        )

        if (
            current_track.get('uri') == encoded_audio_url
            and transport_info.get('current_transport_state') == 'PAUSED_PLAYBACK'
        ):
            _log_debug(
                'Matching active URL paused on speaker. Executing raw UPnP resume play command.'
            )
            if on_track_finished:
                _log_debug(
                    'Attaching event tracking hooks to AVTransport handler channel during resume sequence.'
                )
                listener = SonosTrackCompletionListener(sonos_player, on_track_finished)
                sub = sonos_player.avTransport.subscribe()
                listener.start(sub)
                _active_subscriptions[uid] = listener
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
                f'<upnp:albumArtURI>{escaped_cover_art_url}</upnp:albumArtURI>'
                if escaped_cover_art_url
                else ''
            )
            + '<upnp:class>object.item.audioItem.musicTrack</upnp:class>'
            f'<res protocolInfo="http-get:*:audio/mpeg:*">{escaped_audio_url}</res>'
            '</item>'
            '</DIDL-Lite>'
        )

        _log_debug('Wiping hardware coordinator playback queue buffer...')
        sonos_player.clear_queue()

        _log_debug(
            f'Injecting track resource configuration URL to internal queue layout. Metadata size: {len(meta_xml)} bytes.'
        )
        sonos_player.add_uri_to_queue(encoded_audio_url, meta=meta_xml)

        if on_track_finished:
            _log_debug(
                'Subscribing listener mapping handler directly to UPnP network broadcast channel...'
            )
            listener = SonosTrackCompletionListener(sonos_player, on_track_finished)
            sub = sonos_player.avTransport.subscribe()
            listener.start(sub)
            _active_subscriptions[uid] = listener

        _log_debug(
            'Firing play command tracking request for queue position point index 0.'
        )
        sonos_player.play_from_queue(0)
        _log_debug('Sonos network packet transaction pipeline completed successfully.')
    except Exception as sonos_err:
        log.error(
            f'Sonos hardware interaction failed with network execution error: {sonos_err}'
        )


def get_status(remote_player):
    connection_info = json.loads(remote_player.connection_info_json)
    sonos_player = soco.SoCo(connection_info['host'])

    try:
        track_info = sonos_player.get_current_track_info()
        transport_info = sonos_player.get_current_transport_info()

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
