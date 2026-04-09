from typing import Union, Literal
from pydantic import BaseModel

class User(BaseModel):
    id: int | None = None
    username: str
    display_name: str | None = None
    hashed_password: str | None = None
    raw_password: str | None = ''
    has_password: bool | None = False
    enabled: bool | None = True
    permissions: str
    cduid: int | None = None
    ticket: list[int] | None = None
    set_password: bool | None = False


class AuthToken(BaseModel):
    access_token: str
    token_type: str


class AuthTokenContent(BaseModel):
    username: str | None = None
    scopes: list[str] = []
    client_device_user_id: int

class UserAccess(BaseModel):
    user_id: int
    tag_ids: list[int]
    shelf_ids: list[int]
    stream_source_ids: list[int]

class JobRequest(BaseModel):
    name: Union[
        Literal["apply_directory_tag"],
        Literal["clean_file_records"],
        Literal['delete_media_records'],
        Literal["read_media_files"],
        Literal["scan_shelves_content"],
    ]
    input: dict | None = None


class Job(BaseModel):
    id: int | None = None
    kind: str
    message: str
    status: str

class ShelfKind(BaseModel):
    name: Union[
        Literal["Movies"],
        Literal["Shows"],
        Literal["Keepsakes"]
    ]


class Shelf(BaseModel):
    id: int | None = None
    kind: str
    name: str
    local_path: str
    network_path: str


class AudioFile(BaseModel):
    id: int | None = None


class Movie(BaseModel):
    id: int | None = None
    name: str
    directory: str


class MovieVideoFile(BaseModel):
    id: int | None = None


class Tag(BaseModel):
    id: int | None = None
    name: str

class DisplayCleanupRule(BaseModel):
    id: int | None = None
    needle: str
    replacement: str
    target_kind: str | None = None
    rule_kind: str | None = None
    priority: int | None = None

class TagRule(BaseModel):
    tag_name: str | None = None
    trigger_kind: str
    trigger_target: str
    id: int | None = None
    target_kind: str | None = None
    rule_kind: str | None = None
    priority: int | None = None
