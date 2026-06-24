import re
import os
from log import log
from pathlib import Path
from db import db
from message.handler.scan_shelf.shelf_scanner import ShelfScanner
import snow_media.nfo
from settings import config


def is_audio(file_path):
    ff = file_path.lower()
    return '.mp3' in ff or '.wav' in ff or '.flac' in ff


def is_image(file_path):
    ff = file_path.lower()
    return '.jpg' in ff or '.png' in ff or '.bmp' in ff or '.jpeg' in ff


def parse_song_info(file_path):
    location = file_path.replace('\\', '/')
    if is_image(location) and not 'scans' in location.lower():
        parts = location.split('/')
        return {'album': parts[-2], 'path': location}
    if is_audio(file_path):
        parts = location.split('/')

        name = parts[-1]
        for suffix in [
            '.adjusted.mp3',
            '.adjusted.flac',
            '.adjusted.wav',
            '.mp3',
            '.flac',
            '.wav',
        ]:
            if name.endswith(suffix):
                name = name[: -len(suffix)]
                break

        album = parts[-2]
        year = None
        if '(' in album:
            album_pieces = album.split(' (')
            album = album_pieces[0]
            year = float(album_pieces[-1].split(')')[0])
        if 'Vol.' in album:
            album_parts = album.split(' - ')
            album_parts.pop(0)
            album = ' - '.join(album_parts)
        pieces = name.split(' - ')
        count = len(pieces)
        position = pieces[0]
        track = position
        disc = None
        if 'D' in position:
            disc = int(position.split('T')[0].replace('D', ''))
            track = int(position.split('T')[1].replace('T', ''))
        elif 'T' in position:
            track = int(position.replace('T', ''))
        else:
            track = int(position)
        title = pieces[1]
        fingerprint = pieces[-1]
        artist = None
        if count > 3:
            artist = ' - '.join(pieces[2:-1])
        else:
            artist = parts[-3]
        if 'Special' == artist:
            artist = parts[-4]
        if '(' in artist:
            artist = artist.split('(')[0].strip()
        return {
            'album': album,
            'path': location,
            'fingerprint': fingerprint,
            'title': title,
            'position': position,
            'artist': artist,
            'year': year,
            'track': track,
            'disc': disc,
            'audio_url': '',
            'kind': '',
        }
    if '.nfo' in location:
        return {'path': location}
    return None


def identify_song_file_kind(extension_kind: str, info: dict, file_path: str):
    if extension_kind == 'metadata':
        return 'album_info'
    if extension_kind == 'image':
        return 'album_cover'
    if extension_kind == 'audio':
        return 'song'
    return None


class SongScanHandler(ShelfScanner):
    def __init__(self, scope, shelf, target_directory=None):
        super().__init__(
            scope=scope,
            shelf=shelf,
            identifier=identify_song_file_kind,
            parser=parse_song_info,
            target_directory=target_directory,
        )

    def organize_images(self):
        progress_count = 0
        for info in self.file_info_lookup['image']:
            try:
                progress_count += 1
                if progress_count % 500 == 0:
                    db.op.update_job(
                        job_id=self.scope.job_id,
                        message=f'Organize movie image {progress_count} out of {len(self.file_info_lookup["image"])}',
                    )
                # not sure if this is needed anymore?
            except Exception as e:
                db.op.update_job(
                    job_id=self.scope.job_id,
                    message=f'An error occurred while processing image [{info["file_path"]}]',
                )
                import traceback

                db.op.update_job(
                    job_id=self.scope.job_id, message=f'{traceback.format_exc()}'
                )

    def organize_metadata(self):
        progress_count = 0
        for info in self.file_info_lookup['metadata']:
            try:
                progress_count += 1
                if progress_count % 500 == 0:
                    db.op.update_job(
                        job_id=self.scope.job_id,
                        message=f'Organize movie metadata {progress_count} out of {len(self.file_info_lookup["metadata"])}',
                    )
                # Read metadata and provide album/artist mappings?
            except Exception as e:
                db.op.update_job(
                    job_id=self.scope.job_id,
                    message=f'An error occurred while processing metadata [{info["file_path"]}]',
                )
                import traceback

                db.op.update_job(
                    job_id=self.scope.job_id, message=f'{traceback.format_exc()}'
                )

    def organize_audio(self):
        progress_count = 0
        for info in self.file_info_lookup['audio']:
            try:
                pass
                # Create albums/artists/etc
            except Exception as e:
                db.op.update_job(
                    job_id=self.scope.job_id,
                    message=f'An error occurred while processing audio [{info["file_path"]}]',
                )
                import traceback

                db.op.update_job(
                    job_id=self.scope.job_id, message=f'{traceback.format_exc()}'
                )
