from database.operation.db_internal import dbi


def upsert_remote_player(name: str, kind: str, connection_info_json: str):
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
            dbm.connection_info_json = connection_info_json

            db.add(dbm)
            db.commit()
            db.refresh(dbm)
            return dbm

        remote_player.kind = kind
        remote_player.connection_info_json = connection_info_json
        db.commit()
        db.refresh(remote_player)
        return remote_player


def get_remote_player_by_id(id: int):
    with dbi.session() as db:
        return (
            db.query(dbi.dm.RemotePlayer).filter(dbi.dm.RemotePlayer.id == id).first()
        )


def get_remote_player_by_name(name: str):
    with dbi.session() as db:
        return (
            db.query(dbi.dm.RemotePlayer)
            .filter(dbi.dm.RemotePlayer.name == name)
            .first()
        )


def get_remote_player_list():
    with dbi.session() as db:
        return db.query(dbi.dm.RemotePlayer).order_by(dbi.dm.RemotePlayer.name).all()
