from database.operation.db_internal import dbi


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
