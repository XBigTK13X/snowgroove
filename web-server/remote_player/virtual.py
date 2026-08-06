import json
import threading
import time
from log import log
from settings import config


def _log_debug(message):
    if config.debug_remote_players:
        log.info(f'[Virtual-DEBUG] {message}')


class VirtualPlayerState:
    def __init__(self, name):
        self.name = name
        self.is_playing = False
        self.position_seconds = 0
        self.duration_seconds = 180
        self.volume = 1.0
        self.last_update_time = time.time()
        self.timer_thread = None
        self.stop_event = threading.Event()
        self.on_track_finished = None
        self.lock = threading.Lock()

    def _sync_position(self):
        now = time.time()
        if self.is_playing:
            elapsed = now - self.last_update_time
            self.position_seconds += elapsed
            if self.position_seconds >= self.duration_seconds:
                self.position_seconds = self.duration_seconds
                self.is_playing = False
                if self.on_track_finished:
                    callback = self.on_track_finished
                    self.on_track_finished = None
                    threading.Thread(target=callback, daemon=True).start()
        self.last_update_time = now

    def play(self, audio_file, on_track_finished=None):
        with self.lock:
            self._sync_position()
            self.duration_seconds = audio_file.get('duration', 180)
            self.position_seconds = 0
            self.is_playing = True
            self.on_track_finished = on_track_finished
            self.last_update_time = time.time()
            self._start_ticker()

    def pause(self):
        with self.lock:
            self._sync_position()
            self.is_playing = False

    def resume(self):
        with self.lock:
            self._sync_position()
            if self.position_seconds < self.duration_seconds:
                self.is_playing = True
                self.last_update_time = time.time()
                self._start_ticker()

    def stop(self):
        with self.lock:
            self._sync_position()
            self.is_playing = False
            self.position_seconds = 0
            self.on_track_finished = None

    def seek(self, target_seconds):
        with self.lock:
            self._sync_position()
            self.position_seconds = min(target_seconds, self.duration_seconds)
            self.last_update_time = time.time()

    def set_volume(self, volume_level):
        with self.lock:
            self.volume = max(0.0, min(1.0, volume_level))

    def get_status(self):
        with self.lock:
            self._sync_position()
            return {
                'position_seconds': int(self.position_seconds),
                'is_playing': self.is_playing,
            }

    def _start_ticker(self):
        self.stop_event.set()
        self.stop_event = threading.Event()
        self.timer_thread = threading.Thread(
            target=self._ticker_loop, args=(self.stop_event,), daemon=True
        )
        self.timer_thread.start()

    def _ticker_loop(self, stop_event):
        while not stop_event.is_set():
            time.sleep(1.0)
            with self.lock:
                if not self.is_playing:
                    break
                self._sync_position()
                if not self.is_playing:
                    break


_virtual_instances = {}
_instances_lock = threading.Lock()


def _get_player_instance(remote_player):
    connection_info = json.loads(remote_player.connection_info_json)
    player_id = connection_info.get('virtual_id', remote_player.name)

    with _instances_lock:
        if player_id not in _virtual_instances:
            _virtual_instances[player_id] = VirtualPlayerState(remote_player.name)
        return _virtual_instances[player_id]


def scan_remote_players():
    network_payload = {
        'virtual_id': 'virtual_dev_player_01',
        'description': 'Mock In-Memory Remote Player',
    }
    return [
        {
            'kind': 'virtual',
            'device_make': 'Virtual Player',
            'name': 'Mock',
            'connection_info_json': json.dumps(network_payload),
        }
    ]


def play(connection_info, audio_file, on_track_finished=None):
    player_id = connection_info.get('virtual_id', 'virtual_dev_player_01')
    with _instances_lock:
        if player_id not in _virtual_instances:
            _virtual_instances[player_id] = VirtualPlayerState('Virtual Remote Player')
        player_instance = _virtual_instances[player_id]

    _log_debug(
        f'Play requested for track "{audio_file.get("title", "Unknown")}". Target ID: {player_id}'
    )
    player_instance.play(audio_file, on_track_finished=on_track_finished)


def act(remote_player, remote_action, music_session):
    player_instance = _get_player_instance(remote_player)
    _log_debug(
        f'Action "{remote_action}" dispatched to virtual device "{remote_player.name}"'
    )

    if remote_action == 'pause':
        player_instance.pause()
    elif remote_action == 'stop':
        player_instance.stop()
    elif remote_action == 'play':
        player_instance.resume()
    elif remote_action.startswith('seek--'):
        seek_target = remote_action.split('seek--')[-1]
        if seek_target.isdigit():
            player_instance.seek(int(seek_target))
    elif remote_action.startswith('volume--'):
        volume_target = remote_action.split('volume--')[-1]
        player_instance.set_volume(float(volume_target))


def get_status(remote_player):
    player_instance = _get_player_instance(remote_player)
    return player_instance.get_status()
