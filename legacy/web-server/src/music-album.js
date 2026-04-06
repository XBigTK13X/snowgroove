const util = require('./util')

class MusicAlbum {
    constructor(musicFile, coverArtUrl) {
        if (!musicFile) {
            return this
        }
        this.Album = musicFile.Album
        this.DisplayAlbum = musicFile.DisplayAlbum
        this.DisplayArtist = musicFile.DisplayArtist
        this.SearchAlbum = util.searchify(this.Album + this.DisplayAlbum)
        this.AlbumSlug = musicFile.AlbumSlug
        this.Artist = musicFile.Artist
        this.CoverArt = coverArtUrl
        this.ThumbnailCoverArt = util.nginxThumbnailPath(coverArtUrl, false)
        this.Kind = musicFile.Kind
        this.ReleaseYear = musicFile.ReleaseYear
        this.ReleaseYearSort = musicFile.ReleaseYearSort
        this.Songs = []
        this.SubKind = musicFile.SubKind
    }

    rehydrate(instance) {
        Object.assign(this, instance)
        return this
    }

    matches(query) {
        return this.SearchAlbum.includes(query)
    }
}

module.exports = MusicAlbum
