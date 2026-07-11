import json
from log import log
import queue
import threading
import time
from db import db
import remote_player.chromecast as chromecast
import remote_player.sonos as sonos


def scan_remote_players(job_id: int):
    db.op.update_job(job_id=job_id, message=f'Searching for Chromecast devices')
    chromecast_players = chromecast.scan_remote_players()
    db.op.update_job(job_id=job_id, message=f'Searching for Sonos devices')
    sonos_players = sonos.scan_remote_players()
    remote_players = chromecast_players + sonos_players
    for remote_player in remote_players:
        db.op.update_job(
            job_id=job_id,
            message=f'Discovered remote_player [{remote_player["kind"]}] [{remote_player["name"]}]',
        )
        db.op.upsert_remote_player(
            name=remote_player['name'],
            kind=remote_player['kind'],
            device_make=remote_player['device_make'],
            connection_info_json=remote_player['connection_info_json'],
        )
    return remote_players


class RemotePlayers:
    def __init__(self):
        self.active_connections = {}
        self.registry_lock = threading.Lock()

    def recover_active_sessions(self):
        active_sessions = db.op.get_remote_music_session_list()
        for music_session in active_sessions:
            remote_player = db.op.get_remote_player_by_id(
                ticket=None, id=music_session.remote_player_id
            )
            if remote_player:
                with self.registry_lock:
                    if remote_player.id not in self.active_connections:
                        message_queue = queue.Queue()
                        worker_thread = threading.Thread(
                            target=self._device_worker,
                            args=(remote_player, None, message_queue),
                            daemon=True,
                        )
                        self.active_connections[remote_player.id] = (
                            worker_thread,
                            message_queue,
                        )
                        worker_thread.start()
                        log.info(
                            f'Recovered remote player connection for {remote_player.name} on startup'
                        )

    def _device_worker(self, remote_player, initial_action, message_queue):
        pending_seek = None
        seek_execution_time = 0.0
        debounce_wait = 0.35
        last_action = initial_action
        is_recovered_startup = initial_action is None
        was_playing = False

        last_status_check = 0.0
        status_interval = 2.0

        if initial_action:
            if initial_action.startswith('seek--'):
                pending_seek = initial_action
                seek_execution_time = time.time() + debounce_wait
            else:
                try:
                    self._execute_action(
                        remote_player=remote_player, remote_action=initial_action
                    )
                except Exception as execute_error:
                    log.error(f'Initial action execution failed: {execute_error}')

        try:
            while True:
                now = time.time()
                timeout = None

                if pending_seek is not None:
                    timeout = max(0.0, seek_execution_time - now)
                else:
                    timeout = max(0.0, (last_status_check + status_interval) - now)

                try:
                    if timeout == 0.0:
                        raise queue.Empty

                    remote_action = message_queue.get(timeout=timeout)
                    is_recovered_startup = False

                    if remote_action.startswith('seek--'):
                        pending_seek = remote_action
                        seek_execution_time = time.time() + debounce_wait
                    else:
                        if pending_seek is not None:
                            try:
                                self._execute_action(
                                    remote_player=remote_player,
                                    remote_action=pending_seek,
                                )
                                last_action = pending_seek
                            except Exception as seek_error:
                                log.error(
                                    f'Debounced seek execution failed: {seek_error}'
                                )
                            pending_seek = None

                        try:
                            self._execute_action(
                                remote_player=remote_player, remote_action=remote_action
                            )
                            last_action = remote_action
                        except Exception as action_error:
                            log.error(f'Action execution failed: {action_error}')

                    message_queue.task_done()

                except queue.Empty:
                    if pending_seek is not None and time.time() >= seek_execution_time:
                        try:
                            self._execute_action(
                                remote_player=remote_player, remote_action=pending_seek
                            )
                            last_action = pending_seek
                        except Exception as seek_error:
                            log.error(f'Debounced seek execution failed: {seek_error}')
                        pending_seek = None

                now = time.time()
                if now >= last_status_check + status_interval:
                    last_status_check = now
                    try:
                        player_status = self.get_status(remote_player)
                        is_playing = player_status.get('is_playing', False)
                        if is_recovered_startup:
                            is_recovered_startup = False
                            if not is_playing:
                                last_action = 'pause'
                                was_playing = False
                                continue

                        if was_playing and not is_playing and last_action != 'pause':
                            music_session = db.op.get_music_session_by_remote_player_id(
                                remote_player_id=remote_player.id
                            )
                            if music_session:
                                music_queue = json.loads(music_session.music_queue_json)
                                if music_queue:
                                    try:
                                        self._execute_action(
                                            remote_player=remote_player,
                                            remote_action='next',
                                        )
                                        last_action = 'next'
                                    except Exception as next_action_error:
                                        log.error(
                                            f'[Worker-{remote_player.id}] Failed executing next action: {next_action_error}'
                                        )

                            was_playing = False
                        else:
                            if is_playing:
                                was_playing = True
                            elif last_action == 'pause':
                                was_playing = False

                    except Exception as loop_iteration_error:
                        log.warning(
                            f'Transient hardware status error: {loop_iteration_error}'
                        )
                        continue

        except Exception as terminal_error:
            log.critical(
                f'Fatal error encountered in device worker loop: {terminal_error}'
            )
        finally:
            with self.registry_lock:
                connection_pair = self.active_connections.get(remote_player.id)
                if connection_pair and connection_pair[0] == threading.current_thread():
                    self.active_connections.pop(remote_player.id, None)

    def _execute_action(self, remote_player, remote_action):
        music_session = db.op.get_music_session_by_remote_player_id(
            remote_player_id=remote_player.id
        )
        if not music_session:
            return
        music_session.music_queue = json.loads(music_session.music_queue_json)
        if remote_action == 'next':
            music_session.music_queue['current_song_index'] += 1
            if (
                music_session.music_queue['current_song_index']
                > len(music_session.music_queue['songs']) - 1
            ):
                music_session.music_queue['current_song_index'] = 0
            db.op.update_music_session_music_queue(
                music_session_id=music_session.id, music_queue=music_session.music_queue
            )
        elif remote_action == 'previous':
            music_session.music_queue['current_song_index'] -= 1
            if music_session.music_queue['current_song_index'] < 0:
                music_session.music_queue['current_song_index'] = (
                    len(music_session.music_queue['songs']) - 1
                )
            db.op.update_music_session_music_queue(
                music_session_id=music_session.id, music_queue=music_session.music_queue
            )
        if remote_player.kind == 'sonos':
            action_handler = sonos
            action_handler.act(remote_player, remote_action, music_session)
        elif remote_player.kind == 'chromecast':
            action_handler = chromecast
            action_handler.act(remote_player, remote_action, music_session)
        else:
            log.info(f'Unhandled remote_player kind [{remote_player.kind}]')

    def dispatch(self, remote_player, remote_action):
        with self.registry_lock:
            if remote_player.id in self.active_connections:
                worker_thread, message_queue = self.active_connections[remote_player.id]
                if worker_thread.is_alive():
                    message_queue.put(remote_action)
                    return 'forwarded'

            message_queue = queue.Queue()
            message_queue.put(remote_action)
            worker_thread = threading.Thread(
                target=self._device_worker,
                args=(remote_player, None, message_queue),
                daemon=True,
            )
            self.active_connections[remote_player.id] = (worker_thread, message_queue)
            worker_thread.start()
            return 'created'

    def get_status(self, remote_player):
        try:
            if remote_player.kind == 'sonos':
                return sonos.get_status(remote_player)
            elif remote_player.kind == 'chromecast':
                return chromecast.get_status(remote_player)
            else:
                log.warning(f'Unhandled status lookup for kind [{remote_player.kind}]')
                return {'position_seconds': 0, 'is_playing': False}
        except Exception as ee:
            log.error(
                f'Failed to fetch hardware status for player {remote_player.id}: {ee}'
            )
            return {'position_seconds': 0, 'is_playing': False}
