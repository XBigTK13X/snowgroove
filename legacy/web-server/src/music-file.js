const settings = require('./settings')
const util = require('./util')

class MusicFile {
    constructor(path) {
        if (!path) {
            return this
        }

        this.LocalFilePath = path
        this.RelativeFilePath = this.LocalFilePath.replace(settings.mediaRoot, '')
        this.LocalPathParts = this.RelativeFilePath.split('/')
        this.AudioUrl = util.nginxMediaPath(path)
        this.CoverArt = null
        this.AlbumCoverArt = null
        this.EmbeddedCoverArt = null
        this.ThumbnailCoverArt = null

        this.parseMetadataFromPath()

        this.Album = this.Album.trim()
        this.Artist = this.Artist.trim()
        this.Title = this.Title.trim()
        this.DisplayAlbum = this.DisplayAlbum.trim()
        this.DisplayArtist = this.DisplayArtist.trim()
        this.SearchTerms = util.searchify(this.Title + this.DisplayArtist)
        this.AlbumSlug = `${this.Album}-${this.Artist}`
    }

    parseMetadataFromPath() {
        // No matter the sub structure, the top level directory is always the *kind*
        this.Kind = this.LocalPathParts[1]
        this.parseSubKind()
        this.parseAlbumInfo()
        this.parseArtist()
        this.parseTrackAndTitle()
    }

    parseSubKind() {
        this.SubKind = null
        for (let subKind of settings.subKinds) {
            if (this.LocalFilePath.indexOf('/' + subKind + '/') !== -1) {
                this.SubKind = subKind
                break
            }
        }
    }

    parseAlbumInfo() {
        this.ReleaseYear = 9999
        this.Album = this.LocalPathParts[this.LocalPathParts.length - 2]

        for (let part of this.LocalPathParts) {
            if (part !== this.LocalPathParts[this.LocalPathParts.length - 1]) {
                if (part.includes('(') && part.includes(')')) {
                    let albumParts = part.split('(')
                    let year = albumParts.pop().split(')')[0]
                    this.ReleaseYear = parseInt(year.split('.')[0], 10)
                    this.ReleaseYearSort = parseFloat(year)
                    this.Album = albumParts.join('(')
                }
            }
        }
        this.DisplayAlbum = this.Album
    }

    parseArtist() {
        if (this.LocalPathParts.length <= 4) {
            this.Artist = this.LocalPathParts[1]
        } else {
            this.Artist = this.LocalPathParts[2]
            // A-Z Folder workaround
            if (this.Artist.length === 1) {
                this.Artist = '(' + this.LocalPathParts[2] + ') ' + this.LocalPathParts[1]
            }
        }
        this.DisplayArtist = this.Artist
    }

    parseTrackAndTitle() {
        let trackAndTitle = this.LocalPathParts[this.LocalPathParts.length - 1].split('.')
        //Remove the 'adjusted' keyword and file extension
        trackAndTitle.pop()
        trackAndTitle.pop()
        trackAndTitle = trackAndTitle.join('.')
        this.Title = trackAndTitle
        //Everything that has been fingerprinted should have at least one dash
        if (trackAndTitle.includes(' - ')) {
            let titleParts = trackAndTitle.split(' - ')
            this.TitleParts = titleParts
            // The fingerprint is always the last item in the filename after the last dash
            this.Id = titleParts.pop()
            if (titleParts[0].includes('D')) {
                let discAndTrackParts = titleParts[0].split('D')[1].split('T')
                this.Disc = parseInt(discAndTrackParts[0], 10)
                this.Track = parseInt(discAndTrackParts[1], 10)
                titleParts.shift()
                this.Title = titleParts.join(' - ')
            } else {
                this.Disc = 1
                this.Track = parseInt(titleParts.shift(), 10)
                this.Title = titleParts.join(' - ')
            }
            if (this.DisplayAlbum.includes('Vol. ')) {
                let albumParts = this.DisplayAlbum.split(' - ')
                albumParts.shift()
                this.DisplayAlbum = albumParts.join(' - ')
            }
        }
    }

    rehydrate(instance) {
        Object.assign(this, instance)
        return this
    }

    populateMetadata(embeddedCoverArt, durationSeconds) {
        if (embeddedCoverArt) {
            this.EmbeddedCoverArt = util.nginxMediaPath(embeddedCoverArt)
            this.ThumbnailCoverArt = util.nginxThumbnailPath(embeddedCoverArt, true)
        }
        if (durationSeconds) {
            this.AudioDuration = durationSeconds
        }
    }

    matches(query) {
        return this.SearchTerms.includes(query)
    }
}

module.exports = MusicFile
