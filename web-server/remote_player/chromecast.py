import json
from datetime import datetime
import pychromecast

def scan_network_devices():
    devices, browser = pychromecast.discovery.discover_listed_chromecasts()
    pychromecast.discovery.stop_discovery(browser)

    discovered_records = []
    current_time = datetime.utcnow()

    for device in devices:
        # device properties match pychromecast.models.CastInfo structures
        network_payload = {
            "host": device.host,
            "port": device.port,
            "uuid": str(device.uuid),
            "cast_type": device.cast_type
        }

        record = {
            "created_at": current_time,
            "updated_at": current_time,
            "kind": device.model_name, # e.g. 'Google Home Mini', 'Nest Audio', 'Google Cast Group'
            "name": device.friendly_name, # e.g. 'Kitchen Speaker'
            "connection_info": json.dumps(network_payload)
        }
        discovered_records.append(record)

    return discovered_records

def sync_devices_to_db(session, remote_player_table):
    records = scan_network_devices()
    if not records:
        return

    for record in records:
        existing = session.query(remote_player_table).filter_by(name=record["name"]).first()

        if existing:
            # Update network fields and timestamp if it changed or dropped/reassigned IP
            existing.connection_info = record["connection_info"]
            existing.kind = record["kind"]
            existing.updated_at = record["updated_at"]
        else:
            # New device found on subnet segment
            new_player = remote_player_table(**record)
            session.add(new_player)

    session.commit()

def play_to_static_ip(target_ip, media_url, mime_type="audio/mp3"):
    # Directly queries the specific IP to fetch its active port and UUID instantly
    chromecasts, browser = pychromecast.get_chromecasts(known_hosts=[target_ip])
    pychromecast.discovery.stop_discovery(browser)

    if not chromecasts:
        return False

    cast_device = chromecasts[0]
    cast_device.wait()

    media_ctrl = cast_device.media_controller
    media_ctrl.play_media(media_url, mime_type)
    media_ctrl.block_until_active()
    return True

# chromecast will need a route like this, since it has no onboard playlist support (low memory limit of like 100 items)
import json
import logging
from fastapi import FastAPI, BackgroundTasks, HTTPException, Body, Depends
from sqlalchemy.orm import Session
import pychromecast

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("snowgroove")

app = FastAPI(title="snowgroove")

# (Assume get_db and RemotePlayer are imported from your core models)

# ==============================================================================
# 1. STATE MONITORING & TRACK BOUNDARY AUTOMATION
# ==============================================================================

class DatabaseSessionListener:
    """
    Listens for track completion events. When a track finishes, it spins up
    a short-lived connection worker to look up the DB state and append the next item.
    """
    def __init__(self, player_id: int, host_ip: str, db_session_factory):
        self.player_id = player_id
        self.host_ip = host_ip
        self.db_factory = db_session_factory

    def new_media_status(self, status):
        if status.player_state == "IDLE" and status.idle_reason == "FINISHED":
            logger.info(f"Player ID {self.player_id} reached track boundary. Advancing session.")

            # Instantly handle top-off asynchronously
            db_session = self.db_factory()
            try:
                player = db_session.query(RemotePlayer).get(self.player_id)
                if not player or not player.is_active:
                    return

                # Advance track index pointer inside the DB row state
                player.current_index += 1
                playlist_id = player.playlist_id
                current_index = player.current_index
                db_session.commit()

                # Fetch target cast device using its static IP
                chromecasts, browser = pychromecast.get_chromecasts(known_hosts=[self.host_ip])
                pychromecast.discovery.stop_discovery(browser)

                if chromecasts:
                    cast_device = chromecasts[0]
                    cast_device.wait()

                    next_track_url = f"http://media-host:8080/tracks/playlist_{playlist_id}/track_{current_index}.mp3"
                    logger.info(f"Enqueuing track {current_index} to hardware window: {next_track_url}")

                    # Push track down the live sliding hardware buffer
                    cast_device.media_controller.play_media(next_track_url, "audio/mp3", enqueue=True)
            except Exception as error:
                logger.error(f"Failed to auto-advance database session window: {error}")
            finally:
                db_session.close()

# ==============================================================================
# 2. OFF-WEB-THREAD OPERATIONS (JUST-IN-TIME CONNECTIONS)
# ==============================================================================

def network_play_worker(player_id: int, host_ip: str, playlist_id: int, db_session_factory):
    """
    Connects to the hardware, attaches the ephemeral DB listener, and
    bootstraps the initial sliding track window.
    """
    try:
        chromecasts, browser = pychromecast.get_chromecasts(known_hosts=[host_ip])
        pychromecast.discovery.stop_discovery(browser)

        if not chromecasts:
            logger.error(f"Device at {host_ip} unreachable during session bootstrap")
            return

        cast_device = chromecasts[0]
        cast_device.wait()

        # Attach the custom database listener right into this connection session
        listener = DatabaseSessionListener(player_id, host_ip, db_session_factory)
        cast_device.media_controller.register_status_listener(listener)

        # Pull foundational track parameters
        track_1_url = f"http://media-host:8080/tracks/playlist_{playlist_id}/track_0.mp3"
        track_2_url = f"http://media-host:8080/tracks/playlist_{playlist_id}/track_1.mp3"

        # Seed the hardware layer buffer
        cast_device.media_controller.play_media(track_1_url, "audio/mp3")
        cast_device.media_controller.play_media(track_2_url, "audio/mp3", enqueue=True)

        # Keep the background listener alive for the duration of active playback
        # pychromecast uses internal worker threads that persist as long as the socket stays open

    except Exception as error:
        logger.error(f"Error handling play worker routing: {error}")

def network_stop_worker(host_ip: str):
    """
    Connects to the speaker just-in-time to cleanly drop its current app execution context.
    """
    try:
        chromecasts, browser = pychromecast.get_chromecasts(known_hosts=[host_ip])
        pychromecast.discovery.stop_discovery(browser)

        if chromecasts:
            cast_device = chromecasts[0]
            cast_device.wait()
            cast_device.media_controller.stop()
            cast_device.quit_app()
    except Exception as error:
        logger.error(f"Error executing stop sequence worker: {error}")

# ==============================================================================
# 3. FASTAPI STATELESS CONTROLLERS
# ==============================================================================

@app.post("/api/player/{player_id}/play")
async def start_playlist_session(
    player_id: int,
    playlist_id: int = Body(..., embed=True),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db_session: Session = Depends(get_db)
):
    player = db_session.query(RemotePlayer).get(player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player registration record missing")

    connection_data = json.loads(player.connection_info)
    host_ip = connection_data["host"]

    # Commit the state boundaries to the central row immediately
    player.is_active = True
    player.playlist_id = playlist_id
    player.current_index = 0
    db_session.commit()

    # Hand off execution thread work using SessionLocal factory for thread safety
    from core.database import SessionLocalFactory
    background_tasks.add_task(
        network_play_worker,
        player.id,
        host_ip,
        playlist_id,
        SessionLocalFactory
    )

    return {"status": "session_initiated", "player": player.name}

@app.post("/api/player/{player_id}/skip")
async def skip_next_track(
    player_id: int,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db_session: Session = Depends(get_db)
):
    player = db_session.query(RemotePlayer).get(player_id)
    if not player or not player.is_active:
        raise HTTPException(status_code=400, detail="No active session found for target device")

    connection_data = json.loads(player.connection_info)
    host_ip = connection_data["host"]

    # Just-in-time control routing to skip the item on hardware buffer
    def execute_skip():
        chromecasts, browser = pychromecast.get_chromecasts(known_hosts=[host_ip])
        pychromecast.discovery.stop_discovery(browser)
        if chromecasts:
            cast_device = chromecasts[0]
            cast_device.wait()
            cast_device.media_controller.queue_next()

    background_tasks.add_task(execute_skip)
    return {"status": "skip_dispatched"}

@app.post("/api/player/{player_id}/stop")
async def terminate_session(
    player_id: int,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db_session: Session = Depends(get_db)
):
    player = db_session.query(RemotePlayer).get(player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player entry missing")

    connection_data = json.loads(player.connection_info)
    host_ip = connection_data["host"]

    # Clean up state indicators inside DB row
    player.is_active = False
    player.playlist_id = None
    player.current_index = 0
    db_session.commit()

    background_tasks.add_task(network_stop_worker, host_ip)
    return {"status": "session_stopped"}