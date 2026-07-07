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

    def _device_worker(self, remote_player, initial_action, message_queue):
        pending_seek = None
        seek_execution_time = 0.0
        debounce_wait = 0.35

        if initial_action.startswith('seek--'):
            pending_seek = initial_action
            seek_execution_time = time.time() + debounce_wait
        else:
            self._execute_action(
                remote_player=remote_player, remote_action=initial_action
            )

        try:
            while True:
                now = time.time()
                timeout = None

                if pending_seek is not None:
                    timeout = max(0.0, seek_execution_time - now)

                try:
                    if timeout == 0.0:
                        raise queue.Empty

                    remote_action = message_queue.get(
                        timeout=timeout if timeout is not None else 1.0
                    )

                    if remote_action.startswith('seek--'):
                        pending_seek = remote_action
                        seek_execution_time = time.time() + debounce_wait
                    else:
                        if pending_seek is not None:
                            self._execute_action(
                                remote_player=remote_player, remote_action=pending_seek
                            )
                            pending_seek = None

                        self._execute_action(
                            remote_player=remote_player, remote_action=remote_action
                        )

                    message_queue.task_done()

                except queue.Empty:
                    if pending_seek is not None and time.time() >= seek_execution_time:
                        self._execute_action(
                            remote_player=remote_player, remote_action=pending_seek
                        )
                        pending_seek = None

        except Exception as error_message:
            log.error(f'Error encountered in device worker loop: {error_message}')
        finally:
            with self.registry_lock:
                connection_pair = self.active_connections.get(remote_player.id)
                if connection_pair and connection_pair[0] == threading.current_thread():
                    self.active_connections.pop(remote_player.id, None)

    def _execute_action(self, remote_player, remote_action):
        music_session = db.op.get_music_session_by_remote_player_id(
            remote_player_id=remote_player.id
        )
        music_session.music_queue = json.loads(music_session.music_queue_json)
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
            worker_thread = threading.Thread(
                target=self._device_worker,
                args=(remote_player, remote_action, message_queue),
                daemon=True,
            )
            self.active_connections[remote_player.id] = (worker_thread, message_queue)
            worker_thread.start()
            return 'created'
