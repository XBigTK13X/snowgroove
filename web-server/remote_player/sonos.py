import time
import urllib.parse
import json
import soco
import threading
import queue
from db import db
from log import log
from settings import config
from soco.data_structures import DidlMusicTrack, DidlResource
import xml.etree.ElementTree as ET

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
        self._worker_thread = None
        self._running = False
        self._initial_track_uri = None
        _log_debug(
            f'SonosTrackCompletionListener provisioned for speaker UID: {sonos_player.uid}'
        )

    def start(self, subscription):
        self.subscription = subscription
        self._running = True

        try:
            current_info = self.sonos_player.get_current_track_info()
            self._initial_track_uri = current_info.get('uri')

            # Seed the playing status directly from the hardware on startup
            transport_info = self.sonos_player.get_current_transport_info()
            if transport_info.get('current_transport_state') == 'PLAYING':
                self._was_playing = True
        except Exception:
            self._initial_track_uri = None

        self._worker_thread = threading.Thread(target=self._event_loop, daemon=True)
        self._worker_thread.start()

    def _event_loop(self):
        _log_debug(f'Sonos event listener thread started for {self.sonos_player.uid}')
        while self._running and self.subscription:
            try:
                event = self.subscription.events.get(timeout=1.0)
                transport_state = event.variables.get('current_transport_state')

                current_uri = None
                track_meta_xml = event.variables.get('current_track_meta_data')
                if track_meta_xml and hasattr(track_meta_xml, 'item'):
                    current_uri = getattr(track_meta_xml.item, 'resources', [None])[0]
                    if current_uri and hasattr(current_uri, 'uri'):
                        current_uri = current_uri.uri

                _log_debug(
                    f'Inbound UPnP AVTransport event received -> State: {transport_state}. Was playing flag: {self._was_playing}'
                )

                # If an event payload has an empty state, pull the current info directly from hardware
                if not transport_state:
                    try:
                        transport_info = self.sonos_player.get_current_transport_info()
                        transport_state = transport_info.get(
                            'current_transport_state', 'STOPPED'
                        )
                    except Exception:
                        continue

                if transport_state == 'PLAYING':
                    self._was_playing = True

                has_dropped_to_stopped = (
                    self._was_playing and transport_state == 'STOPPED'
                )
                has_advanced_track = False

                if self._initial_track_uri and transport_state in (
                    'PLAYING',
                    'TRANSITIONING',
                ):
                    try:
                        if not current_uri:
                            current_info = self.sonos_player.get_current_track_info()
                            current_uri = current_info.get('uri')

                        if current_uri and current_uri != self._initial_track_uri:
                            has_advanced_track = True
                    except Exception:
                        pass

                if has_dropped_to_stopped or has_advanced_track:
                    _log_debug(
                        f'Sonos end-of-track marker verified (Stopped: {has_dropped_to_stopped}, Track Shifted: {has_advanced_track}). Triggering next hook.'
                    )
                    self._was_playing = False
                    self._running = False

                    threading.Thread(
                        target=self._trigger_completion, daemon=True
                    ).start()
                    break
            except queue.Empty:
                continue
            except Exception as loop_err:
                _log_debug(
                    f'Exception inside Sonos event listener thread loop: {loop_err}'
                )
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


def play(device_ip, audio_file, on_track_finished=None, device_uid=None):
    _log_debug(f'Play invocation initiated. Sonos target IP: {device_ip}')
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
            f'<dc:creator>{audio_file.get("artist", "Unknown Artist")}</dc:creator>'
            f'<upnp:artist>{audio_file.get("artist", "Unknown Artist")}</upnp:artist>'
            f'<upnp:album>{audio_file.get("album", "Unknown Album")}</upnp:album>'
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
