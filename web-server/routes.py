import cache
import json
import util
import uuid
import os
from datetime import datetime, timezone

import httpx
from fastapi import Response, Request
from fastapi import Security
from fastapi.responses import PlainTextResponse, StreamingResponse

from auth import get_current_user
from db import db
from log import log
from settings import config
from snow_media.transcode_sessions import transcode_sessions
from typing import Annotated
import api_models as am
import message.write
import snow_media

def register(router):
    router = no_auth_required(router)
    return auth_required(router)

def auth_required(router):
    @router.get("/auth/check",tags=['User'])
    def auth_check(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])]
    ):
        return True

    @router.post("/job",tags=['Job'])
    def create_job(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
        jobRequest: am.JobRequest,
    ):
        if not auth_user.is_admin():
            return False
        job = db.op.create_job(kind=jobRequest.name,input=jobRequest.input)
        message.write.send(job_id=job.id, kind=jobRequest.name, input=jobRequest.input, auth_user=auth_user)
        return job

    @router.get("/job",tags=['Job'])
    def get_job(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
        job_id: int,
    ):
        return db.op.get_job_by_id(job_id=job_id)

    @router.get("/job/list", tags=['Job'])
    def get_job_list(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
        show_complete: bool = True,
        limit: int = 1000
    ):
        return db.op.get_job_list(show_complete=show_complete, limit=limit)

    @router.get('/log/list', tags=['Job'])
    def get_log_list(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])]
    ):
        playback_logs = db.op.get_cached_text_list(search_query="playback-log-")
        transcode_logs = []
        for root, dirs, files in os.walk(config.transcode_log_dir):
            for ff in files:
                transcode_logs.append(os.path.join(root,ff))
        transcode_logs.sort(reverse=True)
        return {
            'server': config.tail_log_paths,
            'playback': playback_logs,
            'transcode': transcode_logs
        }

    @router.get('/log', tags=['Job'])
    def get_log(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
        log_index: int=None,
        transcode_log_path: str=None
    ):
        log_path = None
        if log_index != None:
            log_path = config.tail_log_paths[log_index]
        if transcode_log_path:
            if config.transcode_log_dir in transcode_log_path:
                log_path = transcode_log_path
            else:
                return f'Log path [{transcode_log_path}] not found in [{config.transcode_log_dir}]'
        if not log_path:
            return 'Log path not found'
        with open(log_path,'r') as read_handle:
            lines = read_handle.readlines()
            lines.reverse()
            lines = lines[:150]
            return '\n'.join(lines)

    @router.get("/shelf/list",tags=['Shelf'])
    def get_shelf_list(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])]
    ):
        return db.op.get_shelf_list(ticket=auth_user.ticket)

    @router.get("/shelf",tags=['Shelf'])
    def get_shelf(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
        shelf_id: int,
    ):
        if not auth_user.ticket.is_allowed(shelf_id=shelf_id):
            return None
        return db.op.get_shelf_by_id(shelf_id=shelf_id)

    @router.post("/shelf",tags=['Shelf'])
    def save_shelf(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
        shelf: am.Shelf,
    ):
        if not auth_user.is_admin():
            return None
        return db.op.upsert_shelf(shelf=shelf)

    @router.delete("/shelf/{shelf_id}",tags=['Shelf'])
    def delete_shelf(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
        shelf_id: int,
    ):
        if not auth_user.is_admin():
            return None
        return db.op.delete_shelf_by_id(shelf_id=shelf_id)

    @router.post("/user",tags=['User'])
    def save_user(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
        user: am.User,
    ):
        return db.op.upsert_user(user=user)

    @router.get('/user',tags=['User'])
    def get_user(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
        user_id: int
    ):
        return db.op.get_user_by_id(user_id=user_id)

    @router.delete("/user/{user_id}",tags=['User'])
    def delete_user(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
        user_id: int,
    ):
        if not auth_user.is_admin():
            return None
        return db.op.delete_user_by_id(user_id=user_id)

    @router.post('/user/access',tags=['User'])
    def save_user_access(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
        user_access: am.UserAccess
    ):
        if not auth_user.is_admin():
            return None
        return db.op.save_user_access(user_access=user_access)

    @router.get('/search', tags=['User'])
    def perform_search(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
        query:str
    ):
        return db.op.perform_search(ticket=auth_user.ticket,query=query)

    @router.get('/tag',tags=['Tag'])
    def get_user(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
        tag_id: int
    ):
        if not auth_user.ticket.is_allowed(tag_id=tag_id):
            return None
        return db.op.get_tag_by_id(tag_id=tag_id)

    @router.get('/tag/list',tags=['Tag'])
    def get_tag_list(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])]
    ):
        return db.op.get_tag_list(ticket=auth_user.ticket)

    @router.post('/tag',tags=['Tag'])
    def save_tag(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
        tag: am.Tag
    ):
        if not auth_user.is_admin():
            return None
        return db.op.upsert_tag(tag)

    @router.delete('/tag/{tag_id}',tags=['Tag'])
    def delete_tag(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
        tag_id:int
    ):
        if not auth_user.is_admin():
            return None
        return db.delete_tag_by_id(tag_id=tag_id)

    @router.get("/movie/list",tags=['Movie'])
    def get_movie_list(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
        shelf_id: int,
        show_playlisted:bool=True
    ):
        return db.op.get_movie_list(
            ticket=auth_user.ticket,
            shelf_id=shelf_id,
            show_playlisted=show_playlisted,
            load_files=False
        )

    @router.get("/movie",tags=['Movie'])
    def get_movie_details(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
        movie_id: int,
        device_profile:str,
    ):
        movie = db.op.get_movie_by_id(ticket=auth_user.ticket,movie_id=movie_id)
        if movie == None:
            return None
        movie.shelf_name = movie.shelf.name
        movie.watched = db.op.get_movie_watched(ticket=auth_user.ticket,movie_id=movie_id)
        movie.has_extras = False
        movie.has_versions = False

        for ii in range(0,len(movie.video_files)):
            movie.video_files[ii].info = json.loads(movie.video_files[ii].snowstream_info_json)
            del movie.video_files[ii].snowstream_info_json
            if device_profile:
                plan = snow_media.planner.create_plan(
                    device_profile=device_profile,
                    snowstream_info=movie.video_files[ii].info,
                    video_kind="movie"
                )
                movie.video_files[ii].plan = plan
            movie.video_files[ii].file_index = ii
            if 'main_feature' in movie.video_files[ii].kind:
                movie.main_feature_index = ii
            if 'extra' in movie.video_files[ii].kind:
                movie.has_extras = True
                movie.video_files[ii].is_extra = True
            if movie.video_files[ii].version:
                movie.has_versions = True
        search_query = f'reddit movies discussion {movie.name} ({movie.release_year})'
        movie.discussion_image_url,movie.discussion_url = util.search_to_base64_qrcode(search_query)
        return movie

    @router.get('/keepsake')
    def get_keepsake(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
        shelf_id:str = None,
        subdirectory64:str = None
    ):
        shelf = db.op.get_shelf_by_id(shelf_id=shelf_id)
        absolute_subdirectory = shelf.local_path
        if subdirectory64:
            absolute_subdirectory = util.fromBase64(subdirectory64)

        current_keepsake = db.op.get_keepsake_by_directory(directory=absolute_subdirectory)

        images = []
        videos = []

        if current_keepsake:
            images = current_keepsake.image_files
            videos = current_keepsake.video_files

            for video in videos:
                if video.snowstream_info_json:
                    video.info = json.loads(video.snowstream_info_json)
                    del video.snowstream_info_json

            for image in images:
                image.name = image.local_path.split('/')[-1]

            videos.sort(key=lambda xx: xx.name)
            images.sort(key=lambda xx: xx.name)

        raw_paths = db.op.get_keepsake_subdirectories(directory=absolute_subdirectory)

        directories = []
        directory_dedupe = {}

        for row in raw_paths:
            full_path = row[0]

            if full_path == absolute_subdirectory:
                continue

            dir_name = full_path.replace(absolute_subdirectory, '')
            parts = dir_name.split('/')

            subdir = None
            for part in parts:
                if part:
                    subdir = part
                    break

            if subdir and subdir not in directory_dedupe:
                directory_dedupe[subdir] = True
                directories.append({
                    'display': subdir,
                    'path': os.path.join(absolute_subdirectory, subdir)
                })

        directories.sort(key=lambda xx: xx['display'])

        return {
            'videos': videos,
            'images': images,
            'directories': directories,
            'shelf': shelf
        }

    @router.get("/device/profile/list",tags=['User'])
    def get_device_profile_list(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
    ):
        return {'devices':[xx.name for xx in snow_media.device.device_list]}

    @router.get("/session/list",tags=['User'])
    def get_session_list(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])]
    ):
        transcodes = db.op.get_transcode_session_list()
        return {
            'transcodes': transcodes
        }

    @router.get("/playing/queue",tags=['User'])
    def get_playing_queue(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
        show_id:int=None,
        show_season_id:int=None,
        tag_id:int=None,
        shuffle:bool=False,
        source:str=None
    ):
        queue = db.op.get_playing_queue(
            ticket=auth_user.ticket,
            show_id=show_id,
            show_season_id=show_season_id,
            tag_id=tag_id,
            shuffle=shuffle,
            source=source
        )
        kind = None
        kind_id = None
        item = None
        if show_id:
            kind_id = show_id
            kind = 'show'
            item = db.op.get_show_by_id(ticket=auth_user.ticket,show_id=show_id)
        if show_season_id:
            kind = 'show_season'
            kind_id = show_season_id
            item = db.op.get_show_season_by_id(ticket=auth_user.ticket,season_id=show_season_id)
        if tag_id:
            kind = 'playlist'
            kind_id = tag_id
            item = db.op.get_tag_by_id(tag_id=kind_id)
            item.model_kind = 'playlist'
        if not kind and source:
            scrub = source.replace('-shuffle','')
            parts = scrub.split('-')
            kind = parts[0]
            kind_id = int(parts[1])
            if kind == 'show':
                item = db.op.get_show_by_id(ticket=auth_user.ticket,show_id=kind_id)
            if kind == 'show_season':
                item = db.op.get_show_season_by_id(ticket=auth_user.ticket,season_id=kind_id)
            if kind == 'tag':
                kind = 'playlist'
                item = db.op.get_tag_by_id(tag_id=kind_id)
                item.model_kind = 'playlist'

        return {
            'queue':queue,
            'kind': kind,
            'kind_id': kind_id,
            'item': item
        }

    @router.post('/playing/queue',tags=['User'])
    def update_playing_queue(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
        source:str,
        progress:int
    ):
        db.op.update_playing_queue(ticket=auth_user.ticket,source=source,progress=progress)
        return db.op.get_playing_queue(ticket=auth_user.ticket,source=source)

    @router.delete('/cached/text', tags=['Admin'])
    def delete_all_cached_text(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])]
    ):
        if not auth_user.is_admin():
            return False
        db.op.delete_all_cached_text()
        return True

    @router.post('/display-cleanup-rule', tags=['Admin'])
    def save_display_cleanup_rule(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
        rule: am.DisplayCleanupRule
    ):
        if not auth_user.is_admin():
            return False
        if rule.id != None:
            return db.op.update_display_cleanup_rule(
                rule_id=rule.id,
                priority=rule.priority,
                rule_kind=rule.rule_kind,
                target_kind=rule.target_kind,
                needle=rule.needle,
                replacement=rule.replacement
            )
        return db.op.create_display_cleanup_rule(
            priority=rule.priority,
            rule_kind=rule.rule_kind,
            target_kind=rule.target_kind,
            needle=rule.needle,
            replacement=rule.replacement
        )

    @router.get('/display-cleanup-rule', tags=['Admin'])
    def get_display_cleanup_rule(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
        rule_id:int
    ):
        if not auth_user.is_admin():
            return False
        return db.op.get_display_cleanup_rule(rule_id=rule_id)

    @router.delete('/display-cleanup-rule', tags=['Admin'])
    def delete_display_cleanup_rule(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
        rule_id:int
    ):
        if not auth_user.is_admin():
            return False
        return db.op.delete_display_cleanup_rule(rule_id=rule_id)

    @router.get('/display-cleanup-rule/list', tags=['Admin'])
    def get_display_cleanup_rule_list(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])]
    ):
        if not auth_user.is_admin():
            return None
        return db.op.get_display_cleanup_rule_list()

    @router.post('/tag-rule', tags=['Admin'])
    def save_tag_rule(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
        rule: am.TagRule
    ):
        if not auth_user.is_admin():
            return False

        tag = db.op.get_tag_by_name(rule.tag_name)

        if rule.id != None:
            return db.op.update_tag_rule(
                tag_id=tag.id,
                rule_id=rule.id,
                priority=rule.priority,
                rule_kind=rule.rule_kind,
                target_kind=rule.target_kind,
                trigger_kind=rule.trigger_kind,
                trigger_target=rule.trigger_target
            )
        return db.op.create_tag_rule(
            tag_id=tag.id,
            priority=rule.priority,
            rule_kind=rule.rule_kind,
            target_kind=rule.target_kind,
            trigger_kind=rule.trigger_kind,
            trigger_target=rule.trigger_target
        )

    @router.get('/tag-rule', tags=['Admin'])
    def get_tag_rule(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
        rule_id:int
    ):
        if not auth_user.is_admin():
            return False
        return db.op.get_tag_rule(rule_id=rule_id)

    @router.delete('/tag-rule', tags=['Admin'])
    def delete_tag_rule(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
        rule_id:int
    ):
        if not auth_user.is_admin():
            return False
        return db.op.delete_tag_rule(rule_id=rule_id)

    @router.get('/tag-rule/list', tags=['Admin'])
    def get_tag_rule_list(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])]
    ):
        if not auth_user.is_admin():
            return None
        return db.op.get_tag_rule_list()

    @router.post('/hotfix', tags=['Admin'])
    def deployment_hotfix(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
    ):
        return True

    return router


def no_auth_required(router):
    @router.get("/heartbeat",tags=['Unauthed'])
    def heartbeat():
        return {"alive": True}

    @router.get("/info",tags=['Unauthed'])
    def info():
        return {
            "serverVersion": config.server_version,
            "serverBuildDate": config.server_build_date,
        }

    @router.get("/password/hash",tags=['Unauthed'])
    def password_hash(password: str):
        return util.get_password_hash(password)


    @router.get("/user/list",tags=['Unauthed'])
    def get_user_list(device_name:str=None):
        users = db.op.get_user_list()
        results = []
        admin = None
        for user in users:
            user.hashed_password = None
            if user.username == 'admin':
                admin = user
            else:
                if device_name in config.auth_device_whitelist:
                    user.has_password = False
                results.append(user)
        results.append(admin)

        return results

    return router
