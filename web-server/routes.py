import json
import util
import uuid
import os
from datetime import datetime, timezone

import httpx
from fastapi import Response, Request, Body
from fastapi import Security
from fastapi.responses import PlainTextResponse, StreamingResponse

from auth import get_current_user
from db import db
from log import log
from settings import config
from typing import Annotated
import api_models as am
import message.write
import snow_media


def register(router):
    router = no_auth_required(router)
    return auth_required(router)


def user_routes(router):
    @router.post('/user', tags=['User'])
    def save_user(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
        user: am.User,
    ):
        return db.op.upsert_user(user=user)

    @router.get('/user', tags=['User'])
    def get_user(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
        user_id: int,
    ):
        return db.op.get_user_by_id(user_id=user_id)

    @router.delete('/user/{user_id}', tags=['User'])
    def delete_user(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
        user_id: int,
    ):
        if not auth_user.is_admin():
            return None
        return db.op.delete_user_by_id(user_id=user_id)

    @router.post('/user/access', tags=['User'])
    def save_user_access(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
        user_access: am.UserAccess,
    ):
        if not auth_user.is_admin():
            return None
        return db.op.save_user_access(user_access=user_access)


def job_routes(router):
    @router.post('/job', tags=['Job'])
    def create_job(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
        name: str = Body(),
        input: dict = Body(),
    ):
        if not auth_user.is_admin():
            return False
        job = db.op.create_job(kind=name, input=input)
        message.write.send(job_id=job.id, kind=name, input=input, auth_user=auth_user)
        return job

    @router.get('/job', tags=['Job'])
    def get_job(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
        job_id: int,
    ):
        return db.op.get_job_by_id(job_id=job_id)

    @router.get('/job/list', tags=['Job'])
    def get_job_list(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
        show_complete: bool = True,
        limit: int = 1000,
    ):
        return db.op.get_job_list(show_complete=show_complete, limit=limit)


def log_routes(router):
    @router.get('/log/list', tags=['Job'])
    def get_log_list(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
    ):
        playback_logs = db.op.get_cached_text_list(search_query='playback-log-')
        transcode_logs = []
        for root, dirs, files in os.walk(config.transcode_log_dir):
            for ff in files:
                transcode_logs.append(os.path.join(root, ff))
        transcode_logs.sort(reverse=True)
        return {
            'server': config.tail_log_paths,
            'playback': playback_logs,
            'transcode': transcode_logs,
        }

    @router.get('/log', tags=['Job'])
    def get_log(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
        log_index: int = None,
        transcode_log_path: str = None,
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
        with open(log_path, 'r') as read_handle:
            lines = read_handle.readlines()
            lines.reverse()
            lines = lines[:150]
            return '\n'.join(lines)


def tag_routes(router):
    @router.get('/tag', tags=['Tag'])
    def get_user(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
        tag_id: int,
    ):
        if not auth_user.ticket.is_allowed(tag_id=tag_id):
            return None
        return db.op.get_tag_by_id(tag_id=tag_id)

    @router.get('/tag/list', tags=['Tag'])
    def get_tag_list(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
    ):
        return db.op.get_tag_list(ticket=auth_user.ticket)

    @router.post('/tag', tags=['Tag'])
    def save_tag(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
        tag: am.Tag,
    ):
        if not auth_user.is_admin():
            return None
        return db.op.upsert_tag(tag)

    @router.delete('/tag/{tag_id}', tags=['Tag'])
    def delete_tag(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
        tag_id: int,
    ):
        if not auth_user.is_admin():
            return None
        return db.delete_tag_by_id(tag_id=tag_id)

    @router.post('/tag-rule', tags=['Admin'])
    def save_tag_rule(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
        rule: am.TagRule,
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
                trigger_target=rule.trigger_target,
            )
        return db.op.create_tag_rule(
            tag_id=tag.id,
            priority=rule.priority,
            rule_kind=rule.rule_kind,
            target_kind=rule.target_kind,
            trigger_kind=rule.trigger_kind,
            trigger_target=rule.trigger_target,
        )

    @router.get('/tag-rule', tags=['Admin'])
    def get_tag_rule(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
        rule_id: int,
    ):
        if not auth_user.is_admin():
            return False
        return db.op.get_tag_rule(rule_id=rule_id)

    @router.delete('/tag-rule', tags=['Admin'])
    def delete_tag_rule(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
        rule_id: int,
    ):
        if not auth_user.is_admin():
            return False
        return db.op.delete_tag_rule(rule_id=rule_id)

    @router.get('/tag-rule/list', tags=['Admin'])
    def get_tag_rule_list(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
    ):
        if not auth_user.is_admin():
            return None
        return db.op.get_tag_rule_list()


def shelf_routes(router):
    @router.get('/shelf/list', tags=['Shelf'])
    def get_shelf_list(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
    ):
        return db.op.get_shelf_list(ticket=auth_user.ticket)

    @router.get('/shelf', tags=['Shelf'])
    def get_shelf(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
        shelf_id: int,
    ):
        if not auth_user.ticket.is_allowed(shelf_id=shelf_id):
            return None
        return db.op.get_shelf_by_id(shelf_id=shelf_id)

    @router.post('/shelf', tags=['Shelf'])
    def save_shelf(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
        kind: str = Body(),
        name: str = Body(),
        local_path: str = Body(),
        network_path: str = Body(),
        id: int = Body(default=None),
    ):
        if not auth_user.is_admin():
            return None
        return db.op.upsert_shelf(
            kind=kind,
            name=name,
            local_path=local_path,
            network_path=network_path,
            id=id,
        )

    @router.delete('/shelf/{shelf_id}', tags=['Shelf'])
    def delete_shelf(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
        shelf_id: int,
    ):
        if not auth_user.is_admin():
            return None
        return db.op.delete_shelf_by_id(shelf_id=shelf_id)

    @router.get('/crate')
    def get_crate(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
        shelf_id: str = None,
        crate_id: str = None,
    ):
        if crate_id == None:
            return {
                'kind': 'crate-list',
                'items': db.op.get_crate_list_by_shelf_id(shelf_id=shelf_id),
            }
        else:
            crate = db.op.get_crate_by_id(crate_id=crate_id)
            # Serialize manually, otherwise FastAPI triggers an infinite recurse
            return {'kind': 'crate-details', 'item': crate}


def music_session_routes(router):
    @router.get('/remote-player/list', tags=['Music Session'])
    def get_remote_player_list(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
    ):
        return db.op.get_remote_player_list()

    @router.get('/remote-player', tags=['Music Session'])
    def get_remote_player_by_id(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
        remote_player_id: int,
    ):
        player = db.op.get_remote_player_by_id(id=remote_player_id)
        if player.music_session:
            player.music_queue = json.loads(player.music_session.music_queue_json)
        return player

    @router.get('/music-session', tags=['Music Session'])
    def get_music_session(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
        remote_player_id: int = None,
    ):
        return db.op.get_or_create_music_session(
            remote_player_id=remote_player_id, cduid=auth_user.cduid
        )

    @router.post('/music-session', tags=['Music Session'])
    def upsert_music_queue(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
        music_session_id: int = Body(),
        music_queue: dict = Body(),
    ):
        return db.op.update_music_session_music_queue(
            music_session_id=music_session_id, music_queue=music_queue
        )

    @router.delete('/music-session/song/next', tags=['Music Session'])
    def play_next_song_in_session(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
    ):
        return True

    @router.post('/music-session/song/previous', tags=['Music Session'])
    def play_previous_song_in_session(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
    ):
        return True

    @router.post('/music-session/play', tags=['Music Session'])
    def play_mussic_session(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
    ):
        return True

    @router.post('/music-session/pause', tags=['Music Session'])
    def pause_music_session(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
    ):
        return True

    @router.post('/music-session/stop', tags=['Music Session'])
    def stop_music_session(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
    ):
        return True


def auth_required(router):
    @router.get('/auth/check', tags=['User'])
    def auth_check(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
    ):
        return True

    @router.get('/search', tags=['User'])
    def perform_search(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])], query: str
    ):
        return db.op.perform_search(ticket=auth_user.ticket, query=query)

    @router.get('/device/profile/list', tags=['User'])
    def get_device_profile_list(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
    ):
        return {'devices': [xx.name for xx in snow_media.device.device_list]}

    @router.delete('/cached/text', tags=['Admin'])
    def delete_all_cached_text(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
    ):
        if not auth_user.is_admin():
            return False
        db.op.delete_all_cached_text()
        return True

    @router.post('/hotfix', tags=['Admin'])
    def deployment_hotfix(
        auth_user: Annotated[am.User, Security(get_current_user, scopes=[])],
    ):
        return True

    user_routes(router)
    job_routes(router)
    log_routes(router)
    tag_routes(router)
    shelf_routes(router)
    music_session_routes(router)

    return router


def no_auth_required(router):
    @router.get('/heartbeat', tags=['Unauthed'])
    def heartbeat():
        return {'alive': True}

    @router.get('/info', tags=['Unauthed'])
    def info():
        return {
            'serverVersion': config.server_version,
            'serverBuildDate': config.server_build_date,
        }

    @router.get('/password/hash', tags=['Unauthed'])
    def password_hash(password: str):
        return util.get_password_hash(password)

    @router.get('/user/list', tags=['Unauthed'])
    def get_user_list(device_name: str = None):
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
