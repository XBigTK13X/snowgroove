def parse(input, key):
    if not input:
        return None
    value = input[key] if key in input else None
    if value == None:
        return None
    if isinstance(value, str):
        if value.isnumeric():
            if '.' in value:
                return float(value)
            return int(value)
        if value.lower() == 'true':
            return True
        if value.lower() == 'false':
            return False
    return value


class JobMediaScope:
    def __init__(self, job_id: int, raw_job_input: dict):
        self.job_id = job_id
        self.input = raw_job_input
        self.target_kind = parse(raw_job_input, 'target_kind')
        self.target_id = parse(raw_job_input, 'target_id')
        self.target_directory = parse(raw_job_input, 'target_directory')
        self.update_songs = parse(raw_job_input, 'update_songs')
        self.update_images = parse(raw_job_input, 'update_images')
        self.update_metadata = parse(raw_job_input, 'update_metadata')
        self.skip_existing = parse(raw_job_input, 'skip_existing')
        self.is_subjob = parse(raw_job_input, 'is_subjob')
        self.spawn_subjob = parse(raw_job_input, 'spawn_subjob')

    def is_unscoped(self):
        return (
            not self.target_kind or not self.target_id
        ) and not self.target_directory

    def is_directory(self):
        return self.target_kind == 'directory' or (
            (self.target_kind == None or self.target_id == None)
            and self.target_directory != None
        )

    def is_shelf(self):
        return self.target_kind == 'shelf'

    def is_song(self):
        return self.target_kind == 'song'

    def is_album(self):
        return self.target_kind == 'album'

    def is_artist(self):
        return self.target_kind == 'artist'

    def is_crate(self):
        return self.target_kind == 'crate'

    def is_orphan(self):
        return self.target_kind == 'orphan'

    def is_tag(self):
        return self.target_kind == 'tag'

    def skip_existing_media(self):
        return self.skip_existing == True
