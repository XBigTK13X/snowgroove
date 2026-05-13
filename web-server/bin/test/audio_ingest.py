from message.handler.scan_shelf.song_scan import parse_song_info

from box import Box

from settings import config

def parse_file(relative_path: str):
    result = Box(parse_song_info(config.media_test_root + '/' + relative_path))
    result.kind = relative_path.split('/')[0]
    return result

def test_anime_metadata():
    song = parse_file('Anime/A Place Further Than the Universe/OP IN ED (2018)/001 - The Girls Are Alright! - 1ec7c9cbb5c038a66f7802a3b9f6f220.adjusted.mp3')
    assert song.title == 'The Girls Are Alright!'
    assert song.album == 'OP IN ED'
    assert song.artist == 'A Place Further Than the Universe'
    assert song.year == 2018

def test_artist_title_dashes():
    song = parse_file('Game/Smash Bros/Vol. 35 - Fatal Fury (2018)/001 - Haremar Faith Capoeira School - Song of the Fight (Believers Will Be Saved) - FATAL FURY - 8ec7c9cbb5c038a66f7802a3b9f6f220.adjusted.mp3"')
    assert song.title == 'Haremar Faith Capoeira School - Song of the Fight (Believers Will Be Saved) - FATAL FURY'

def test_multidisc_track():
    song = parse_file('Game/Nintendo Switch/The Legend of Zelda Breath of the Wild (2018)/D03T31 - Urbosa and the Divine Beast - 7ec7c9cbb5c038a66f7802a3b9f6f220.adjusted.mp3')
    assert song.disc == 3
    assert song.track == 31

def test_artist_metadata():
    song = parse_file('Artist/Barenaked Ladies/Gordon (1992)/04 - Brian Wilson - 2ec7c9cbb5c038a66f7802a3b9f6f220.adjusted.mp3')
    assert song.title == 'Brian Wilson'
    assert song.album == 'Gordon'
    assert song.artist == 'Barenaked Ladies'
    assert song.year == 1992

def test_compilation_metadata():
    song = parse_file('Compilation/Anime Hits (2019)/001 - Tori Kago (ED1) - Darling in the Franxx - 3ec7c9cbb5c038a66f7802a3b9f6f220.adjusted.mp3')
    assert song.title == 'Tori Kago (ED1) - Darling in the Franxx'
    assert song.album == 'Anime Hits'
    assert song.artist == 'Compilation'
    assert song.year == 2019

def test_disney_metadata():
    song = parse_file('Disney/Brave (2012)/001 - Touch The Sky - 4ec7c9cbb5c038a66f7802a3b9f6f220.adjusted.mp3')
    assert song.title == 'Touch The Sky'
    assert song.album == 'Brave'
    assert song.artist == 'Disney'
    assert song.year == 2012

def test_game_metadata():
    song = parse_file('Game/Wii U/Rayman Legends (2013)/007 - Score Recap - 5ec7c9cbb5c038a66f7802a3b9f6f220.adjusted.mp3')
    assert song.title == 'Score Recap'
    assert song.album == 'Rayman Legends'
    assert song.artist == 'Wii U'
    assert song.year == 2013

def test_game_song_id_collision():
    first = parse_file('Game/SNES/Super Mario All-Stars (1993)/D02T001 - Title - Super Mario Bros. 2 - 9ec7c9cbb5c038a66f7802a3b9f6f222.adjusted.mp3')
    second = parse_file('Game/SNES/Super Mario All-Stars (1993)/D01T001 - Title - Super Mario Bros. - 1ac7c9cbb5c038a66f7802a3b9f6f221.adjusted.mp3')
    assert first.id != second.id

def test_movie_metadata():
    song = parse_file('Movie/La La Land (2016)/001 - Another Day of Sun - 6ec7c9cbb5c038a66f7802a3b9f6f220.adjusted.mp3')
    assert song.title == 'Another Day of Sun'
    assert song.album == 'La La Land'
    assert song.artist == 'Movie'
    assert song.year == 2016

def test_smash_bros_metadata():
    song = parse_file('Game/Smash Bros/Vol. 35 - Fatal Fury (2018)/001 - Haremar Faith Capoeira School - Song of the Fight (Believers Will Be Saved) - FATAL FURY - 8ec7c9cbb5c038a66f7802a3b9f6f220.adjusted.mp3"')
    assert song.title == 'Haremar Faith Capoeira School - Song of the Fight (Believers Will Be Saved) - FATAL FURY'
    assert song.album == 'Fatal Fury'
    assert song.artist == 'Smash Bros'
    assert song.year == 2018

def test_smash_bros_removes_vol():
    song = parse_file('Game/Smash Bros/Vol. 35 - Fatal Fury (2018)/001 - Haremar Faith Capoeira School - Song of the Fight (Believers Will Be Saved) - FATAL FURY - 8ec7c9cbb5c038a66f7802a3b9f6f220.adjusted.mp3"')
    assert song.album == 'Fatal Fury'

def test_messy_percent_encoding():
    song = parse_file(r'Anime/K-On/Image Songs - Main Cast Part 1 (2013.06)/008 - Mokujise Happy 100% - 709b6c5b53e298b4c0e92fe2b613d5cf.adjusted.mp3')
    assert '100% ' not in song.audio_url

def test_messy_hash_encoding():
    song = parse_file('Anime/K-On/K-ON Commerical Breaks (2013.14)/025 - Subtitle Track #25 - 5b8f446128ea1b0e32b5fa6f37e03b88.adjusted.mp3')
    assert '#' not in song.audio_url

def test_no_top_level_category():
    song = parse_file('Classical/Johann Sebastian Bach/Bradenburg Concertos (2013)/01 - Brandenburg Concerto No. 1 in F Major, BWV 1046 - I. Allegro - 2eae67b118c6190c6547e6c7c24e4c1e.adjusted.mp3')
    assert song.title == 'Brandenburg Concerto No. 1 in F Major, BWV 1046 - I. Allegro'
    assert song.album == 'Bradenburg Concertos'
    assert song.artist == 'Johann Sebastian Bach'
    assert song.kind == 'Classical'

def test_v2_az_wrapper_folder():
    song = parse_file('Game A-Z/C/Civilization V (2010)/D01T001 - America - Peace - Songs For The Morning Star - dd500993d0eca0f52e33496d8e4da71a.adjusted.mp3')
    assert song.title == 'America - Peace - Songs For The Morning Star'
    assert song.album == 'Civilization V'
    assert song.artist == '(C) Game A-Z'
    assert song.kind == 'Game A-Z'
    assert song.year == 2010

def test_v2_subfolder_as_artist():
    song = parse_file('Anime/Symphogear/Symphogear (2012)/001 - Synchrogazer - 18571a9b29f4632c8be2f3815a14d11b.adjusted.mp3')
    assert song.title == 'Synchrogazer'
    assert song.album == 'Symphogear'
    assert song.artist == 'Symphogear'
    assert song.kind == 'Anime'
    assert song.year == 2012

def test_v2_sub_kind_ignored_as_artist():
    song = parse_file('Anime/Symphogear/Symphogear (2012)/Special/OST 1 (2012)/001 - Sora ni Hoshi Nagare, Namida wa Hoo wo Tsutau (FIRST LOVE SONG) - 6f34f2a42aba236dd92bc7762c76f2df.adjusted.mp3')
    assert song.title == 'Sora ni Hoshi Nagare, Namida wa Hoo wo Tsutau (FIRST LOVE SONG)'
    assert song.album == 'OST 1'
    assert song.artist == 'Symphogear'
    assert song.kind == 'Anime'
    assert song.year == 2012

def test_v2_nested_album_split():
    song = parse_file('Anime/Symphogear/Symphogear (2012)/Character Song 1 - Zwei Wing (2012)/001 - Gyakkou no Flugel - 4dc2ab66e1cb3dcccee8870e6b087058.adjusted.mp3')
    assert song.title == 'Gyakkou no Flugel'
    assert song.album == 'Character Song 1 - Zwei Wing'
    assert song.artist == 'Symphogear'
    assert song.kind == 'Anime'
    assert song.year == 2012