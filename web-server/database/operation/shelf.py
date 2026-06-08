from database.operation.db_internal import dbi


def create_shelf(
    kind: str, name: str, local_path: str, network_path: str, id: int = None
):
    with dbi.session() as db:
        dbm = dbi.dm.Shelf(
            id=id,
            kind=kind,
            name=name,
            local_path=local_path,
            network_path=network_path,
        )
        db.add(dbm)
        db.commit()
        db.refresh(dbm)
        return dbm


def upsert_shelf(
    kind: str, name: str, local_path: str, network_path: str, id: int = None
):
    existing_shelf = None
    if id:
        existing_shelf = get_shelf_by_id(shelf_id=id)
    if not existing_shelf:
        return create_shelf(
            kind=kind, name=name, local_path=local_path, network_path=network_path
        )
    with dbi.session() as db:
        existing_shelf = (
            db.query(dbi.dm.Shelf)
            .filter(dbi.dm.Shelf.id == id)
            .update(
                {
                    'kind': kind,
                    'name': name,
                    'local_path': local_path,
                    'network_path': network_path,
                }
            )
        )
        db.commit()
        return existing_shelf


def get_shelf_list(ticket: dbi.dm.Ticket = None):
    with dbi.session() as db:
        query = db.query(dbi.dm.Shelf)
        if ticket != None and ticket.shelf_ids != None:
            query = query.filter(dbi.dm.Shelf.id.in_(ticket.shelf_ids))
        return query.all()


def get_shelf_by_id(shelf_id: str):
    with dbi.session() as db:
        return db.query(dbi.dm.Shelf).filter(dbi.dm.Shelf.id == shelf_id).first()


def delete_shelf_by_id(shelf_id: str):
    with dbi.session() as db:
        deleted = db.query(dbi.dm.Shelf).filter(dbi.dm.Shelf.id == shelf_id).delete()
        db.commit()
        return deleted
