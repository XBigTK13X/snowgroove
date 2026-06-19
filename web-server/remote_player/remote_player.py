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
        self._execute_action(remote_player=remote_player, remote_action=initial_action)

        try:
            while True:
                try:
                    remote_action = message_queue.get(timeout=1)
                    self._execute_action(
                        remote_player=remote_player, remote_action=remote_action
                    )
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

    def _execute_action(self, remote_player, remote_action):
        log.info(
            f'Executing action {remote_action} on [{remote_player.name}] [{remote_player.kind}]'
        )
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
