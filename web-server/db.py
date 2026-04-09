import database.operation
import database.db_models

from box import Box

db = Box({
    'op': database.operation,
    'Ticket': database.db_models.Ticket,
    'Box': Box
})
