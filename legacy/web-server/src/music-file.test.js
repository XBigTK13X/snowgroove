var assert = require('assert')
var settings = require('./settings')

const MusicFile = require('./music-file')

const parseFile = (relativePath) => {
    return new MusicFile(settings.mediaRoot + '/' + relativePath)
}

describe('MusicFile', function () {
    describe('Anime', function () {
        const AnimeSong = parseFile('Anime/A Place Further Than the Universe/OP IN ED (2018)/001 - The Girls Are Alright! - 1ec7c9cbb5c038a66f7802a3b9f6f220.adjusted.mp3')
        it('should parse metadata', function () {
            assert.equal(AnimeSong.Title, 'The Girls Are Alright!')
            assert.equal(AnimeSong.DisplayAlbum, 'OP IN ED')
            assert.equal(AnimeSong.DisplayArtist, 'A Place Further Than the Universe')
            assert.equal(AnimeSong.ReleaseYear, 2018)
        })
    })
    describe('Artist', function () {
        it('should preserve title dashes', function () {
            const SmashBrosSong = parseFile('Game/Smash Bros/Vol. 35 - Fatal Fury (2018)/001 - Haremar Faith Capoeira School - Song of the Fight (Believers Will Be Saved) - FATAL FURY - 8ec7c9cbb5c038a66f7802a3b9f6f220.adjusted.mp3"')
            assert.equal(SmashBrosSong.Title, 'Haremar Faith Capoeira School - Song of the Fight (Believers Will Be Saved) - FATAL FURY')
        })
        const MultiDiscSong = parseFile('Game/Nintendo Switch/The Legend of Zelda Breath of the Wild (2018)/D03T31 - Urbosa and the Divine Beast - 7ec7c9cbb5c038a66f7802a3b9f6f220.adjusted.mp3')
        it('should read track count from multidisc albums', function () {
            assert.equal(MultiDiscSong.Disc, 3)
            assert.equal(MultiDiscSong.Track, 31)
        })
        const ArtistSong = parseFile('Artist/Barenaked Ladies/Gordon (1992)/04 - Brian Wilson - 2ec7c9cbb5c038a66f7802a3b9f6f220.adjusted.mp3')
        it('should parse metadata', function () {
            assert.equal(ArtistSong.Title, 'Brian Wilson')
            assert.equal(ArtistSong.DisplayAlbum, 'Gordon')
            assert.equal(ArtistSong.DisplayArtist, 'Barenaked Ladies')
            assert.equal(ArtistSong.ReleaseYear, 1992)
        })
    })
    describe('Compilation', function () {
        const CompilationSong = parseFile('Compilation/Anime Hits (2019)/001 - Tori Kago (ED1) - Darling in the Franxx - 3ec7c9cbb5c038a66f7802a3b9f6f220.adjusted.mp3')
        it('should parse metadata', function () {
            assert.equal(CompilationSong.Title, 'Tori Kago (ED1) - Darling in the Franxx')
            assert.equal(CompilationSong.DisplayAlbum, 'Anime Hits')
            assert.equal(CompilationSong.DisplayArtist, 'Compilation')
            assert.equal(CompilationSong.ReleaseYear, 2019)
        })
    })
    describe('Disney', function () {
        const DisneySong = parseFile('Disney/Brave (2012)/001 - Touch The Sky - 4ec7c9cbb5c038a66f7802a3b9f6f220.adjusted.mp3')
        it('should parse metadata when no category under kind', function () {
            assert.equal(DisneySong.Title, 'Touch The Sky')
            assert.equal(DisneySong.DisplayAlbum, 'Brave')
            assert.equal(DisneySong.DisplayArtist, 'Disney')
            assert.equal(DisneySong.ReleaseYear, 2012)
        })
    })
    describe('Game', function () {
        const GameSong = new MusicFile('Game/Wii U/Rayman Legends (2013)/007 - Score Recap - 5ec7c9cbb5c038a66f7802a3b9f6f220.adjusted.mp3')
        it('should parse metadata', function () {
            assert.equal(GameSong.Title, 'Score Recap')
            assert.equal(GameSong.DisplayAlbum, 'Rayman Legends')
            assert.equal(GameSong.DisplayArtist, 'Wii U')
            assert.equal(GameSong.ReleaseYear, 2013)
        })
        const GameSongIdCollisionFirst = parseFile('Game/SNES/Super Mario All-Stars (1993)/D02T001 - Title - Super Mario Bros. 2 - 9ec7c9cbb5c038a66f7802a3b9f6f222.adjusted.mp3')
        const GameSongIdCollisionSecond = parseFile('Game/SNES/Super Mario All-Stars (1993)/D01T001 - Title - Super Mario Bros. - 1ac7c9cbb5c038a66f7802a3b9f6f221.adjusted.mp3')
        it('should use extra file info to prevent song ID collision', function () {
            assert.notEqual(GameSongIdCollisionFirst.Id, GameSongIdCollisionSecond.Id)
        })
    })
    describe('Movie', function () {
        const MovieSong = parseFile('Movie/La La Land (2016)/001 - Another Day of Sun - 6ec7c9cbb5c038a66f7802a3b9f6f220.adjusted.mp3')
        it('should parse metadata', function () {
            assert.equal(MovieSong.Title, 'Another Day of Sun')
            assert.equal(MovieSong.DisplayAlbum, 'La La Land')
            assert.equal(MovieSong.DisplayArtist, 'Movie')
            assert.equal(MovieSong.ReleaseYear, 2016)
        })
    })
    describe('Smash Bros', function () {
        it('should parse metadata', function () {
            const SmashBrosSong = parseFile('Game/Smash Bros/Vol. 35 - Fatal Fury (2018)/001 - Haremar Faith Capoeira School - Song of the Fight (Believers Will Be Saved) - FATAL FURY - 8ec7c9cbb5c038a66f7802a3b9f6f220.adjusted.mp3"')
            assert.equal(SmashBrosSong.Title, 'Haremar Faith Capoeira School - Song of the Fight (Believers Will Be Saved) - FATAL FURY')
            assert.equal(SmashBrosSong.DisplayAlbum, 'Fatal Fury')
            assert.equal(SmashBrosSong.DisplayArtist, 'Smash Bros')
            assert.equal(SmashBrosSong.ReleaseYear, 2018)
        })
        it('should remove .Vol from album title', function () {
            const SmashBrosSong = parseFile('Game/Smash Bros/Vol. 35 - Fatal Fury (2018)/001 - Haremar Faith Capoeira School - Song of the Fight (Believers Will Be Saved) - FATAL FURY - 8ec7c9cbb5c038a66f7802a3b9f6f220.adjusted.mp3"')
            assert.equal(SmashBrosSong.DisplayAlbum, 'Fatal Fury')
        })
    })
    describe('Messy File Names', function () {
        it('should safely encode percent sign', function () {
            const FirstMessySong = parseFile('Anime/K-On/Image Songs - Main Cast Part 1 (2013.06)/008 - Mokujise Happy 100% - 709b6c5b53e298b4c0e92fe2b613d5cf.adjusted.mp3')
            let hasPercent = FirstMessySong.AudioUrl.indexOf('100% ')
            assert.equal(hasPercent, -1)
        })
        it('should safely encode a hash character', function () {
            const SecondMessySong = parseFile('Anime/K-On/K-ON Commerical Breaks (2013.14)/025 - Subtitle Track #25 - 5b8f446128ea1b0e32b5fa6f37e03b88.adjusted.mp3')
            let hasHash = SecondMessySong.AudioUrl.indexOf('#')
            assert.equal(hasHash, -1)
        })
    })
    describe('No top level category', function () {
        it('should parse info without a tertiary dir', function () {
            const ShortPathSong = parseFile('Classical/Johann Sebastian Bach/Bradenburg Concertos (2013)/01 - Brandenburg Concerto No. 1 in F Major, BWV 1046 - I. Allegro - 2eae67b118c6190c6547e6c7c24e4c1e.adjusted.mp3')
            assert.equal(ShortPathSong.Title, 'Brandenburg Concerto No. 1 in F Major, BWV 1046 - I. Allegro')
            assert.equal(ShortPathSong.Album, 'Bradenburg Concertos')
            assert.equal(ShortPathSong.Artist, 'Johann Sebastian Bach')
            assert.equal(ShortPathSong.Kind, 'Classical')
        })
    })

    describe('Version two of the directory structure', function () {
        it('should ignore the single letter wrapper folder', function () {
            const VersionTwoGameSong = parseFile('Game A-Z/C/Civilization V (2010)/D01T001 - America - Peace - Songs For The Morning Star - dd500993d0eca0f52e33496d8e4da71a.adjusted.mp3')
            assert.equal(VersionTwoGameSong.Title, 'America - Peace - Songs For The Morning Star')
            assert.equal(VersionTwoGameSong.Album, 'Civilization V')
            assert.equal(VersionTwoGameSong.Artist, '(C) Game A-Z')
            assert.equal(VersionTwoGameSong.Kind, 'Game A-Z')
            assert.equal(VersionTwoGameSong.ReleaseYear, 2010)
        })

        it('should use the wrapping subfolder as an artist', function () {
            const VersionTwoAnimeSong = parseFile('Anime/Symphogear/Symphogear (2012)/001 - Synchrogazer - 18571a9b29f4632c8be2f3815a14d11b.adjusted.mp3')
            assert.equal(VersionTwoAnimeSong.Title, 'Synchrogazer')
            assert.equal(VersionTwoAnimeSong.Album, 'Symphogear')
            assert.equal(VersionTwoAnimeSong.Artist, 'Symphogear')
            assert.equal(VersionTwoAnimeSong.Kind, 'Anime')
            assert.equal(VersionTwoAnimeSong.ReleaseYear, 2012)
        })

        it('should ignore the sub kind folder as an artist', function () {
            const VersionTwoAnimeSong = parseFile('Anime/Symphogear/Symphogear (2012)/Special/OST 1 (2012)/001 - Sora ni Hoshi Nagare, Namida wa Hoo wo Tsutau (FIRST LOVE SONG) - 6f34f2a42aba236dd92bc7762c76f2df.adjusted.mp3')
            assert.equal(VersionTwoAnimeSong.Title, 'Sora ni Hoshi Nagare, Namida wa Hoo wo Tsutau (FIRST LOVE SONG)')
            assert.equal(VersionTwoAnimeSong.Album, 'OST 1')
            assert.equal(VersionTwoAnimeSong.Artist, 'Symphogear')
            assert.equal(VersionTwoAnimeSong.Kind, 'Anime')
            assert.equal(VersionTwoAnimeSong.ReleaseYear, 2012)
        })

        it('should split nested albums into separate albums', function () {
            const VersionTwoAnimeSong = parseFile('Anime/Symphogear/Symphogear (2012)/Character Song 1 - Zwei Wing (2012)/001 - Gyakkou no Flugel - 4dc2ab66e1cb3dcccee8870e6b087058.adjusted.mp3')
            assert.equal(VersionTwoAnimeSong.Title, 'Gyakkou no Flugel')
            assert.equal(VersionTwoAnimeSong.Album, 'Character Song 1 - Zwei Wing')
            assert.equal(VersionTwoAnimeSong.Artist, 'Symphogear')
            assert.equal(VersionTwoAnimeSong.Kind, 'Anime')
            assert.equal(VersionTwoAnimeSong.ReleaseYear, 2012)
        })
    })
})
