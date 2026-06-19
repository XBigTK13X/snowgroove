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
            connection_info_json=remote_player['connection_info_json'],
        )
    return remote_players


class RemotePlayers:
    def __init__(self):
        self.active_connections = {}
        self.registry_lock = threading.Lock()

    def _device_worker(self, remote_player, initial_action, message_queue):
        self._execute_action(initial_action)

        try:
            while True:
                try:
                    action_data = message_queue.get(timeout=1)
                    self._execute_action(action_data)
                    message_queue.task_done()
                except queue.Empty:
                    pass

        except Exception as error_message:
            pass
        finally:
            with self.registry_lock:
                if (
                    self.active_connections.get(remote_player.id)
                    == threading.current_thread()
                ):
                    self.active_connections.pop(remote_player.id, None)

    def _execute_action(self, remote_action: str):
        log.info(f'Executing action: {remote_action}')

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
