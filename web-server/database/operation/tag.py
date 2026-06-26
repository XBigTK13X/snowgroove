from database.operation.db_internal import dbi
import api_models as am


def create_tag(name: str = None):
    with dbi.session() as db:
        dbm = None
        dbm = dbi.dm.Tag()
        dbm.name = name
        db.add(dbm)
        db.commit()
        db.refresh(dbm)
        return dbm


def get_tag_by_id(tag_id: int):
    with dbi.session() as db:
        return db.query(dbi.dm.Tag).filter(dbi.dm.Tag.id == tag_id).first()


def get_tag_by_name(tag_name: str):
    with dbi.session() as db:
        return db.query(dbi.dm.Tag).filter(dbi.dm.Tag.name == tag_name).first()


def upsert_tag(tag_id: int = None, name: str = None):
    existing = None
    if tag_id:
        existing = get_tag_by_id(tag_id)
    elif name:
        existing = get_tag_by_name(name)
    if not existing:
        return create_tag(name=name)
    with dbi.session() as db:
        existing = (
            db.query(dbi.dm.Tag)
            .filter(dbi.dm.Tag.id == existing.id)
            .update({'name': name})
        )
        db.commit()
        return existing


def get_tag_list(ticket: dbi.dm.Ticket = None):
    with dbi.session() as db:
        query = db.query(dbi.dm.Tag)
        if ticket != None and ticket.tag_ids != None:
            query = query.filter(dbi.dm.Tag.id.in_(ticket.tag_ids))
        query = query.order_by(dbi.dm.Tag.name)
        return query.all()


def delete_tag_by_id(tag_id: int):
    with dbi.session() as db:
        deleted = db.query(dbi.dm.Tag).filter(dbi.dm.Tag.id == tag_id).delete()
        db.commit()
        return deleted
