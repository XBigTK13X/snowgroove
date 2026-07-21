from database.operation.db_internal import dbi
import api_models as am


def create_user(user: am.User):
    with dbi.session() as db:
        model_dump = user.model_dump()
        model_dump['has_password'] = model_dump['raw_password'] != 'SNOWGROOVE_EMPTY'
        model_dump['hashed_password'] = dbi.util.get_password_hash(
            model_dump['raw_password']
        )
        del model_dump['raw_password']
        del model_dump['id']
        del model_dump['cduid']
        del model_dump['ticket']
        del model_dump['set_password']
        dbm = dbi.dm.User(**model_dump)
        db.add(dbm)
        db.commit()
        db.refresh(dbm)
        return dbm


def upsert_user(user: am.User):
    existing = None
    if user.id:
        existing = get_user_by_id(user.id)
    elif user.username:
        existing = get_user_by_name(user.username)
    if not existing:
        return create_user(user)
    with dbi.session() as db:
        model_dump = user.model_dump()
        if model_dump['set_password']:
            if user.raw_password != 'SNOWGROOVE_EMPTY' and user.raw_password != '':
                model_dump['hashed_password'] = dbi.util.get_password_hash(
                    model_dump['raw_password']
                )
                model_dump['has_password'] = True
            else:
                model_dump['hashed_password'] = dbi.util.get_password_hash(
                    'SNOWGROOVE_EMPTY'
                )
                model_dump['has_password'] = False
        else:
            model_dump['hashed_password'] = existing.hashed_password
            model_dump['has_password'] = existing.has_password

        del model_dump['raw_password']
        del model_dump['set_password']
        del model_dump['cduid']
        del model_dump['ticket']

        existing = (
            db.query(dbi.dm.User)
            .filter(dbi.dm.User.id == existing.id)
            .update(model_dump)
        )
        db.commit()
        return existing


def get_user_by_id(user_id: int):
    with dbi.session() as db:
        return (
            db.query(dbi.dm.User)
            .filter(dbi.dm.User.id == user_id)
            .options(dbi.orm.joinedload(dbi.dm.User.access_tags))
            .options(dbi.orm.joinedload(dbi.dm.User.access_shelves))
            .options(dbi.orm.joinedload(dbi.dm.User.access_remote_players))
            .options(dbi.orm.joinedload(dbi.dm.User.access_playlists))
            .first()
        )


def get_user_by_name(username: str):
    with dbi.session() as db:
        query = db.query(dbi.dm.User)
        return query.filter(dbi.dm.User.username == username).first()


def get_user_list():
    with dbi.session() as db:
        return db.query(dbi.dm.User).order_by(dbi.dm.User.username).all()


def delete_user_by_id(user_id: int):
    with dbi.session() as db:
        deleted = db.query(dbi.dm.User).filter(dbi.dm.User.id == user_id).delete()
        db.commit()
        return deleted


def save_user_access(
    user_id: int,
    tag_ids: list[int],
    shelf_ids: list[int],
    remote_player_ids: list[int],
    playlist_names: list[str],
):
    if not user_id:
        return False

    user_tags = []
    for tag_id in tag_ids:
        user_tags.append({'snowgroove_user_id': user_id, 'tag_id': tag_id})

    user_shelves = []
    for shelf_id in shelf_ids:
        user_shelves.append({'snowgroove_user_id': user_id, 'shelf_id': shelf_id})

    user_remote_players = []
    for remote_player_id in remote_player_ids:
        user_remote_players.append(
            {'snowgroove_user_id': user_id, 'remote_player_id': remote_player_id}
        )

    user_playlists = []
    for playlist_name in playlist_names:
        user_playlists.append(
            {'snowgroove_user_id': user_id, 'playlist_name': playlist_name}
        )
    with dbi.session() as db:
        db.query(dbi.dm.UserTag).filter(
            dbi.dm.UserTag.snowgroove_user_id == user_id
        ).delete()
        db.query(dbi.dm.UserShelf).filter(
            dbi.dm.UserShelf.snowgroove_user_id == user_id
        ).delete()
        db.query(dbi.dm.UserRemotePlayer).filter(
            dbi.dm.UserRemotePlayer.snowgroove_user_id == user_id
        ).delete()
        db.query(dbi.dm.UserPlaylist).filter(
            dbi.dm.UserPlaylist.snowgroove_user_id == user_id
        ).delete()
        db.commit()
        db.bulk_insert_mappings(dbi.dm.UserTag, user_tags)
        db.bulk_insert_mappings(dbi.dm.UserShelf, user_shelves)
        db.bulk_insert_mappings(dbi.dm.UserRemotePlayer, user_remote_players)
        db.bulk_insert_mappings(dbi.dm.UserPlaylist, user_playlists)
        db.commit()
    return True
