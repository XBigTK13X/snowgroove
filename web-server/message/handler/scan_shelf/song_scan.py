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
    location = Path(file_path).as_posix()
    if is_image(location) and not 'scans' in location.lower():
        parts = location.split('/')
        return {
            'album': parts[-2],
            'path': location
        }
    if is_audio(file_path):
        parts = location.split('/')
        name = parts[-1].replace('.adjusted.','').replace('.mp3','').replace('.flac','').replace('.wav','')
        album = parts[-2]
        year = None
        if '(' in album:
            album_pieces = album.split(' (')
            album = album_pieces[0]
            year = float(album_pieces[1].split(')')[0])
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
            disc = int(position.split('T')[0].replace('D',''))
            track = int(position.split('T')[1].replace('T',''))
        elif 'T' in position:
            track = int(position.replace('T',''))
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
            'id': fingerprint,
            'title': title,
            'position': position,
            'artist': artist,
            'year': year,
            'track': track,
            'disc': disc,
            'audio_url': '',
            'kind': ''
        }
    if '.nfo' in location:
        return {
            'path': location
        }
    return None


def identify_song_file_kind(extension_kind: str, info: dict, file_path: str):
    if extension_kind == "metadata":
        return (
            "album_info"
        )
    if extension_kind == "image":
        return 'album_cover'
    if extension_kind == "audio":
        return "song"
    return None


class SongScanHandler(ShelfScanner):
    def __init__(self, scope, shelf, target_directory=None):
        super().__init__(
            scope=scope,
            shelf=shelf,
            identifier=identify_song_file_kind,
            parser=parse_song_info,
            target_directory=target_directory
        )

    def get_or_create_song(self, info):
        song_slug = f'{info["song_name"]}-{info["movie_year"]}'
        if not song_slug in self.batch_lookup:
            song = db.op.get_song_by_fingerprint(
                fingerprint=info['song_fingerprint']
            )
            if not song:
                song = db.op.create_song(
                    name=info["song_name"],
                    fingerprint=info["song_fingerprint"],
                    local_path=info['local_path']
                )
                db.op.add_song_to_album(shelf_id=self.shelf.id, movie_id=movie.id)
            if movie.directory != info['directory']:
                db.op.update_movie_directory(movie_id=movie.id,directory=info['directory'])
            self.batch_lookup[song_slug] = movie
        movie = self.batch_lookup[song_slug]
        if not movie.remote_metadata_id and self.scope.metadata_id:
            db.op.update_movie_remote_metadata_id(movie.id, remote_metadata_id=self.scope.metadata_id)
        return song_slug, movie

    def organize_images(self):
        progress_count = 0
        for info in self.file_info_lookup["image"]:
            try:
                progress_count += 1
                if progress_count % 500 == 0:
                    db.op.update_job(job_id=self.scope.job_id, message=f'Organize movie image {progress_count} out of {len(self.file_info_lookup["image"])}')
                song_slug, movie = self.get_or_create_song(info=info)
                if not db.op.get_movie_image_file(
                    movie_id=movie.id, image_file_id=info["id"]
                ):
                    db.op.create_movie_image_file(
                        movie_id=movie.id, image_file_id=info["id"]
                    )
            except Exception as e:
                db.op.update_job(job_id=self.scope.job_id,message=f"An error occurred while processing image [{info['file_path']}]")
                import traceback
                db.op.update_job(job_id=self.scope.job_id,message=f"{traceback.format_exc()}")

    def organize_metadata(self):
        progress_count = 0
        for info in self.file_info_lookup["metadata"]:
            try:
                progress_count += 1
                if progress_count % 500 == 0:
                    db.op.update_job(job_id=self.scope.job_id, message=f'Organize movie metadata {progress_count} out of {len(self.file_info_lookup["metadata"])}')
                song_slug, movie = self.get_or_create_song(info=info)
                if not db.op.get_movie_metadata_file(
                    movie_id=movie.id, metadata_file_id=info["id"]
                ):
                    db.op.create_movie_metadata_file(
                        movie_id=movie.id, metadata_file_id=info["id"]
                    )
                    song_metadata = snow_media.nfo.nfo_path_to_dict(info['file_path'])
            except Exception as e:
                db.op.update_job(job_id=self.scope.job_id,message=f"An error occurred while processing metadata [{info['file_path']}]")
                import traceback
                db.op.update_job(job_id=self.scope.job_id,message=f"{traceback.format_exc()}")


    def organize_videos(self):
        progress_count = 0
        for info in self.file_info_lookup["video"]:
            try:
                progress_count += 1
                if progress_count % 500 == 0:
                    db.op.update_job(job_id=self.scope.job_id, message=f'Organize movie video {progress_count} out of {len(self.file_info_lookup["video"])}')
                song_slug, movie = self.get_or_create_song(info=info)
                if not db.op.get_movie_video_file(
                    movie_id=movie.id, video_file_id=info["id"]
                ):
                    db.op.create_movie_video_file(
                        movie_id=movie.id, video_file_id=info["id"]
                    )
            except Exception as e:
                db.op.update_job(job_id=self.scope.job_id,message=f"An error occurred while processing video [{info['file_path']}]")
                import traceback
                db.op.update_job(job_id=self.scope.job_id,message=f"{traceback.format_exc()}")
