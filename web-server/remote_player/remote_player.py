import json
import queue
import threading
import time
from db import db
from log import log
from settings import config
import remote_player.chromecast as chromecast
import remote_player.sonos as sonos
import remote_player.virtual as virtual


def scan_remote_players(job_id: int):
    db.op.update_job(job_id=job_id, message='Searching for Chromecast devices')
    chromecast_players = chromecast.scan_remote_players()
    db.op.update_job(job_id=job_id, message='Searching for Sonos devices')
    sonos_players = sonos.scan_remote_players()
    db.op.update_job(job_id=job_id, message='Creating Virtual devices')
    virtual_players = virtual.scan_remote_players()
    remote_players = chromecast_players + sonos_players + virtual_players
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

    def _log_debug(self, message):
        if config.debug_remote_players:
            log.info(f'[RemotePlayers-DEBUG] {message}')

    def recover_active_sessions(self):
        recovery_thread = threading.Thread(
            target=self._recover_sessions_worker,
            daemon=True,
        )
        recovery_thread.start()

    def _recover_sessions_worker(self):
        self._log_debug('Starting recovery of active remote music sessions...')
        active_sessions = db.op.get_remote_music_session_list()
        self._log_debug(
            f'Found {len(active_sessions)} active sessions in DB to recover.'
        )
        for music_session in active_sessions:
            remote_player = db.op.get_remote_player_by_id(
                ticket=None, id=music_session.remote_player_id
            )
            if remote_player:
                player_recovery_thread = threading.Thread(
                    target=self._recover_single_player,
                    args=(remote_player,),
                    daemon=True,
                )
                player_recovery_thread.start()

    def _recover_single_player(self, remote_player):
        status = self.get_status(remote_player)
        with self.registry_lock:
            if remote_player.id in self.active_connections:
                self._log_debug(
                    f'Worker for player {remote_player.id} already exists. Skipping recovery.'
                )
                return

            message_queue = queue.Queue()

            def handle_track_finished():
                self._log_debug(
                    f'Track finished callback received for {remote_player.name}. Injecting "next" action.'
                )
                message_queue.put('next')

            if status.get('is_playing'):
                connection_info = json.loads(remote_player.connection_info_json)
                if remote_player.kind == 'sonos':
                    sonos.attach_listener(
                        device_ip=connection_info['host'],
                        on_track_finished=handle_track_finished,
                        device_uid=connection_info.get('uid'),
                    )
                elif remote_player.kind == 'chromecast':
                    chromecast.attach_listener(
                        connection_info=connection_info,
                        on_track_finished=handle_track_finished,
                    )

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
        self._log_debug(
            f'Worker thread spawned for [{remote_player.name}] (ID: {remote_player.id}). Kind: {remote_player.kind}'
        )
        pending_seek = None
        seek_execution_time = 0.0
        debounce_wait = 0.35

        def handle_track_finished():
            self._log_debug(
                f'Track finished callback received for {remote_player.name}. Injecting "next" action.'
            )
            message_queue.put('next')

        if initial_action:
            self._log_debug(
                f'Worker executing initial inbound action: {initial_action}'
            )
            if initial_action.startswith('seek--'):
                pending_seek = initial_action
                seek_execution_time = time.time() + debounce_wait
            else:
                try:
                    self._execute_action(
                        remote_player=remote_player,
                        remote_action=initial_action,
                        on_finished=handle_track_finished,
                    )
                except Exception as execute_error:
                    log.error(f'Initial action execution failed: {execute_error}')

        try:
            while True:
                now = time.time()
                timeout = None

                if pending_seek is not None:
                    timeout = max(0.0, seek_execution_time - now)
                    self._log_debug(
                        f'Worker loop waiting with seek debounce timeout: {timeout}s'
                    )

                try:
                    if timeout == 0.0:
                        raise queue.Empty

                    self._log_debug(
                        f'Worker loop blocking on message queue. Connections active: {list(self.active_connections.keys())}'
                    )
                    remote_action = message_queue.get(timeout=timeout)
                    self._log_debug(
                        f'Worker unblocked! Process action: "{remote_action}"'
                    )

                    if remote_action.startswith('seek--'):
                        pending_seek = remote_action
                        seek_execution_time = time.time() + debounce_wait
                    else:
                        if pending_seek is not None:
                            try:
                                self._log_debug(
                                    f'Executing pending debounced seek before main action: {pending_seek}'
                                )
                                self._execute_action(
                                    remote_player=remote_player,
                                    remote_action=pending_seek,
                                    on_finished=handle_track_finished,
                                )
                            except Exception as seek_error:
                                log.error(
                                    f'Debounced seek execution failed: {seek_error}'
                                )
                            pending_seek = None

                        try:
                            self._execute_action(
                                remote_player=remote_player,
                                remote_action=remote_action,
                                on_finished=handle_track_finished,
                            )
                        except Exception as action_error:
                            log.error(f'Action execution failed: {action_error}')

                    message_queue.task_done()

                except queue.Empty:
                    if pending_seek is not None and time.time() >= seek_execution_time:
                        self._log_debug(
                            f'Seek debounce window reached. Executing: {pending_seek}'
                        )
                        try:
                            self._execute_action(
                                remote_player=remote_player,
                                remote_action=pending_seek,
                                on_finished=handle_track_finished,
                            )
                        except Exception as seek_error:
                            log.error(f'Debounced seek execution failed: {seek_error}')
                        pending_seek = None

        except Exception as terminal_error:
            log.critical(
                f'Fatal error encountered in device worker loop for player {remote_player.id}: {terminal_error}'
            )
        finally:
            with self.registry_lock:
                connection_pair = self.active_connections.get(remote_player.id)
                if connection_pair and connection_pair[0] == threading.current_thread():
                    self._log_debug(
                        f'Worker loop terminating. Removing player {remote_player.id} from active connections.'
                    )
                    self.active_connections.pop(remote_player.id, None)

    def _execute_action(self, remote_player, remote_action, on_finished=None):
        self._log_debug(
            f'Preparing to execute action "{remote_action}" for player "{remote_player.name}"'
        )
        music_session = db.op.get_music_session_by_remote_player_id(
            remote_player_id=remote_player.id
        )
        if not music_session:
            self._log_debug(
                f'Execution halted: No active music session found in DB matching player ID {remote_player.id}'
            )
            return

        music_session.music_queue = json.loads(music_session.music_queue_json)
        self._log_debug(
            f'Loaded music session index: {music_session.music_queue.get("current_song_index")} / Total songs: {len(music_session.music_queue.get("songs", []))}'
        )
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
            self._log_debug('Routing action to sonos module handler.')
            if remote_action in ['play', 'next', 'previous']:
                current_audio_file = music_session.music_queue['songs'][
                    music_session.music_queue['current_song_index']
                ]
                connection_info = json.loads(remote_player.connection_info_json)
                sonos.play(
                    device_ip=connection_info['host'],
                    audio_file=current_audio_file,
                    on_track_finished=on_finished,
                    device_uid=connection_info.get('uid'),
                )
            else:
                sonos.act(remote_player, remote_action, music_session)
        elif remote_player.kind == 'chromecast':
            self._log_debug('Routing action to chromecast module handler.')
            if remote_action in ['play', 'next', 'previous']:
                current_audio_file = music_session.music_queue['songs'][
                    music_session.music_queue['current_song_index']
                ]
                connection_info = json.loads(remote_player.connection_info_json)
                chromecast.play(
                    connection_info, current_audio_file, on_track_finished=on_finished
                )
            else:
                chromecast.act(remote_player, remote_action, music_session)
        elif remote_player.kind == 'virtual':
            self._log_debug('Routing action to virtual module handler.')
            if remote_action in ['play', 'next', 'previous']:
                current_audio_file = music_session.music_queue['songs'][
                    music_session.music_queue['current_song_index']
                ]
                connection_info = json.loads(remote_player.connection_info_json)
                virtual.play(
                    connection_info, current_audio_file, on_track_finished=on_finished
                )
            else:
                virtual.act(remote_player, remote_action, music_session)
        else:
            log.info(f'Unhandled remote_player kind [{remote_player.kind}]')

    def dispatch(self, remote_player, remote_action):
        self._log_debug(
            f'Dispatching remote action request: Player={remote_player.name}, Action={remote_action}'
        )
        with self.registry_lock:
            if remote_player.id in self.active_connections:
                worker_thread, message_queue = self.active_connections[remote_player.id]
                if worker_thread.is_alive():
                    self._log_debug(
                        f'Found existing active worker thread for player {remote_player.id}. Forwarding action to queue.'
                    )
                    message_queue.put(remote_action)
                    return 'forwarded'
                else:
                    self._log_debug(
                        f'Stale worker thread detected for player {remote_player.id}. Re-spawning.'
                    )

            self._log_debug(
                f'Spawning new worker connection loop for player {remote_player.id}'
            )
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
        self._log_debug(
            f'Inbound client request for current runtime status of: {remote_player.name}'
        )
        try:
            if remote_player.kind == 'sonos':
                return sonos.get_status(remote_player)
            elif remote_player.kind == 'chromecast':
                return chromecast.get_status(remote_player)
            elif remote_player.kind == 'virtual':
                return virtual.get_status(remote_player)
            else:
                log.warning(f'Unhandled status lookup for kind [{remote_player.kind}]')
                return {'position_seconds': 0, 'is_playing': False}
        except Exception as hardware_error:
            log.error(
                f'Failed to fetch hardware status for player {remote_player.id}: {hardware_error}'
            )
            return {'position_seconds': 0, 'is_playing': False}

    def stop_all_players(self, ticket):
        self._log_debug('Stopping playback on all known remote players...')
        remote_players = db.op.get_remote_player_list(ticket=ticket)
        for remote_player in remote_players:
            try:
                self._log_debug(
                    f'Dispatching "stop" action to player [{remote_player.name}] (ID: {remote_player.id})'
                )
                with self.registry_lock:
                    if remote_player.id in self.active_connections:
                        worker_thread, message_queue = self.active_connections[
                            remote_player.id
                        ]
                        while not message_queue.empty():
                            try:
                                message_queue.get_nowait()
                                message_queue.task_done()
                            except queue.Empty:
                                break

                self.dispatch(remote_player=remote_player, remote_action='stop')
            except Exception as dispatch_error:
                log.error(
                    f'Failed to stop playback for player {remote_player.id}: {dispatch_error}'
                )


remote_player = RemotePlayers()
