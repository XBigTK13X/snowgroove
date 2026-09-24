from database.operation.db_internal import dbi
import datetime


def upsert_remote_player(
    name: str, kind: str, device_make: str, connection_info_json: str
):
    with dbi.session() as db:
        remote_player = (
            db.query(dbi.dm.RemotePlayer)
            .filter(dbi.dm.RemotePlayer.name == name)
            .first()
        )
        if not remote_player:
            dbm = dbi.dm.RemotePlayer()
            dbm.name = name
            dbm.kind = kind
            dbm.device_make = device_make
            dbm.connection_info_json = connection_info_json

            db.add(dbm)
            db.commit()
            db.refresh(dbm)
            return dbm

        remote_player.kind = kind
        remote_player.device_make = device_make
        remote_player.connection_info_json = connection_info_json
        db.commit()
        db.refresh(remote_player)
        return remote_player


def get_remote_player_by_id(ticket: dbi.dm.Ticket, id: int):
    if ticket:
        if ticket.has_remote_player_restrictions():
            if not ticket.is_allowed(remote_player_id=id):
                return None
    with dbi.session() as db:
        return (
            db.query(dbi.dm.RemotePlayer)
            .filter(dbi.dm.RemotePlayer.id == id)
            .options(dbi.orm.joinedload(dbi.dm.RemotePlayer.music_session))
            .first()
        )


def get_remote_player_by_name(name: str):
    with dbi.session() as db:
        return (
            db.query(dbi.dm.RemotePlayer)
            .filter(dbi.dm.RemotePlayer.name == name)
            .first()
        )


def get_remote_player_list(ticket: dbi.dm.Ticket):
    with dbi.session() as db:
        query = db.query(dbi.dm.RemotePlayer)
        if ticket.has_remote_player_restrictions():
            query = query.filter(dbi.dm.RemotePlayer.id.in_(ticket.remote_player_ids))
        results = query.order_by(dbi.dm.RemotePlayer.name).all()
        if ticket.is_admin:
            return results
        return [xx for xx in results if not xx.kind == 'virtual']


def update_remote_player_status(
    remote_player_id: int,
    is_online: bool = None,
    is_playing: bool = None,
    volume: float = None,
    player_state: str = None,
    last_seen: datetime.datetime = None,
):
    with dbi.session() as db:
        remote_player = (
            db.query(dbi.dm.RemotePlayer)
            .filter(dbi.dm.RemotePlayer.id == remote_player_id)
            .first()
        )
        if not remote_player:
            return None

        if is_online is not None:
            remote_player.is_online = is_online
        if is_playing is not None:
            remote_player.is_playing = is_playing
        if volume is not None:
            remote_player.volume = volume
        if player_state is not None:
            remote_player.player_state = player_state
        if last_seen is not None:
            if isinstance(last_seen, (int, float)):
                remote_player.last_seen = datetime.datetime.fromtimestamp(
                    last_seen, tz=datetime.timezone.utc
                )
            else:
                remote_player.last_seen = last_seen

        db.commit()
        db.refresh(remote_player)
        return remote_player
