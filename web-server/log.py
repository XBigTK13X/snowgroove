import os
import sys
import fcntl
import pprint
import logging
from settings import config

for stream_fd in (sys.stdout.fileno(), sys.stderr.fileno()):
    flags = fcntl.fcntl(stream_fd, fcntl.F_GETFL)
    fcntl.fcntl(stream_fd, fcntl.F_SETFL, flags | os.O_APPEND)

sys.stdout.reconfigure(line_buffering=True, write_through=True)
sys.stderr.reconfigure(line_buffering=True, write_through=True)


class DirectAppendFileHandler(logging.FileHandler):
    def _open(self):
        file_descriptor = os.open(
            self.baseFilename,
            os.O_WRONLY | os.O_CREAT | os.O_APPEND,
            0o666,
        )
        return open(
            file_descriptor,
            mode='a',
            encoding=self.encoding,
            buffering=1,
            closefd=True,
        )

    def emit(self, record: logging.LogRecord):
        super().emit(record)
        self.flush()


LOG_FORMAT = '%(asctime)s %(levelname)-8s %(name)s: %(message)s'
TIME_FORMAT = '%Y-%m-%d %H:%M:%S'

root = logging.getLogger()
root.handlers.clear()
root.setLevel(logging.INFO)


class CallableLogger(logging.Logger):
    def __call__(self, msg, *args, **kwargs):
        self.info(msg, *args, **kwargs)


player_logger = CallableLogger('player')
player_logger.handlers.clear()
player_logger.setLevel(logging.INFO)
player_logger.propagate = False

player_file_handler = DirectAppendFileHandler(config.player_log_path, encoding='utf-8')
player_file_handler.setFormatter(logging.Formatter(LOG_FORMAT, TIME_FORMAT))
player_logger.addHandler(player_file_handler)


class AccessLogFilter(logging.Filter):
    def __init__(
        self,
        player_routes: list[str],
        ignored_routes: list[str],
        redirect_logger: logging.Logger,
    ):
        super().__init__()
        self.player_routes = tuple(player_routes)
        self.ignored_routes = tuple(ignored_routes) if len(ignored_routes) > 0 else None
        self.redirect_logger = redirect_logger

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.args, tuple) and len(record.args) >= 3:
            method = record.args[1]
            request_target = record.args[2]

            if method == 'OPTIONS':
                return False

            if isinstance(request_target, str):
                if self.ignored_routes != None:
                    for ignored_route in self.ignored_routes:
                        if ignored_route in request_target:
                            return False

                for player_route in self.player_routes:
                    if player_route in request_target:
                        self.redirect_logger.handle(record)
                        return False

                return True

        message = record.getMessage()

        if '"OPTIONS ' in message:
            return False

        if self.ignored_routes != None:
            for ignored_route in self.ignored_routes:
                if ignored_route in message:
                    return False

        for player_route in self.player_routes:
            if player_route in message:
                self.redirect_logger.handle(record)
                return False

        return True


access_filter = AccessLogFilter(
    player_routes=[
        '/api/remote-player',
    ],
    ignored_routes=[
        '/api/heartbeat',
    ],
    redirect_logger=player_logger,
)

file_handler = DirectAppendFileHandler(config.log_file_path, encoding='utf-8')
file_handler.setFormatter(logging.Formatter(LOG_FORMAT, TIME_FORMAT))
root.addHandler(file_handler)

stream_handler = logging.StreamHandler(sys.stdout)
stream_handler.setFormatter(logging.Formatter(LOG_FORMAT, TIME_FORMAT))
root.addHandler(stream_handler)


def handle_exception(exc_type, exc_value, exc_traceback):
    if issubclass(exc_type, KeyboardInterrupt):
        sys.__excepthook__(exc_type, exc_value, exc_traceback)
        return
    logging.getLogger().error(
        'Uncaught exception', exc_info=(exc_type, exc_value, exc_traceback)
    )


sys.excepthook = handle_exception

logging.getLogger('pika').setLevel(logging.ERROR)
logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)
logging.getLogger('watchfiles.main').setLevel(logging.ERROR)

pychromecast_logger = logging.getLogger('pychromecast')
pychromecast_logger.setLevel(logging.INFO)
pychromecast_logger.propagate = False
pychromecast_logger.addHandler(player_file_handler)

logging.getLogger('uvicorn.access').addFilter(access_filter)

logging.player = player_logger
logging.pretty = pprint.pprint

log = logging
