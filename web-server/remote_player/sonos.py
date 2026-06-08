import json
from datetime import datetime
import soco


def scan_sonos_network():
    # Discovers all Sonos components on the local subnet via UPnP
    zone_players = soco.discover()

    discovered_records = []
    current_time = datetime.utcnow()

    if not zone_players:
        return discovered_records

    for player in zone_players:
        # Fetch device information dictionary from the hardware
        device_info = player.get_current_track_info()
        speaker_info = player.get_speaker_info()

        # Isolate model identifiers to distinguish Era 100 SL hardware
        model_name = speaker_info.get('model_name', 'Sonos Player')
        friendly_name = player.player_name

        network_payload = {
            'host': player.ip_address,
            'uid': player.uid,  # e.g. RINCON_XXXXXXXXXXXXXXXXX
            'is_visible': player.is_visible,  # False if speaker is a hidden stereo pair secondary
        }

        record = {
            'created_at': current_time,
            'updated_at': current_time,
            'kind': model_name,  # Returns 'Sonos Era 100 SL' or similar hardware identifier
            'name': friendly_name,  # e.g. 'Living Room (L)'
            'connection_info': json.dumps(network_payload),
        }
        discovered_records.append(record)

    return discovered_records


def sync_sonos_to_db(session, remote_player_table):
    records = scan_sonos_network()
    if not records:
        return

    for record in records:
        existing = (
            session.query(remote_player_table).filter_by(name=record['name']).first()
        )

        if existing:
            existing.connection_info = record['connection_info']
            existing.kind = record['kind']
            existing.updated_at = record['updated_at']
        else:
            new_player = remote_player_table(**record)
            session.add(new_player)

    session.commit()


import json
import soco


def play_to_sonos_player(connection_info_str, media_url):
    info = json.loads(connection_info_str)
    target_ip = info['host']

    # Direct instantiation via specific IP — zero discovery overhead
    sonos_player = soco.SoCo(target_ip)

    # Clear the queue and stage the direct HTTP stream asset URL
    sonos_player.clear_queue()
    sonos_player.play_uri(media_url)

    # Execute actual playback transport control
    sonos_player.play()
