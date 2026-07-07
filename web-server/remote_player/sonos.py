import time
import urllib
import json
import soco
from db import db
from log import log
import urllib.parse
from soco.data_structures import DidlMusicTrack, DidlResource
import xml.etree.ElementTree as ET


def scan_remote_players():
    # Discovers all Sonos components on the local subnet via UPnP
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
            'is_visible': player.is_visible,  # False if speaker is a hidden stereo pair secondary
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
    current_audio_file = music_session.music_queue['songs'][
        music_session.music_queue['current_song_index']
    ]
    sonos_player = soco.SoCo(connection_info['host'])

    if remote_action == 'play':
        play(device_ip=connection_info['host'], audio_file=current_audio_file)
    elif remote_action == 'pause':
        sonos_player.pause()
    elif remote_action == 'stop':
        sonos_player.stop()
    elif remote_action == 'next':
        sonos_player.next()
    elif remote_action == 'previous':
        sonos_player.previous()
    elif remote_action.startswith('seek--'):
        seek_target = remote_action.split('seek--')[-1]
        if seek_target.isdigit():
            seek_seconds = int(seek_target)
            formatted_time = time.strftime('%H:%M:%S', time.gmtime(seek_seconds))
            sonos_player.seek(formatted_time)
    else:
        pass


def play(device_ip, audio_file):
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
    artist = audio_file.get('artist', 'Unknown Artist')
    album = audio_file.get('album', 'Unknown Album')

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
            f'<upnp:albumArtURI>{cover_art_url}</upnp:albumArtURI>'
            if cover_art_url
            else ''
        )
        + f'<upnp:class>object.item.audioItem.musicTrack</upnp:class>'
        f'<res protocolInfo="http-get:*:audio/mpeg:*">{encoded_audio_url}</res>'
        '</item>'
        '</DIDL-Lite>'
    )

    sonos_player = soco.SoCo(device_ip)
    sonos_player.clear_queue()
    sonos_player.add_uri_to_queue(encoded_audio_url, meta=meta_xml)
    sonos_player.play_from_queue(0)


comment = """
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


"""
