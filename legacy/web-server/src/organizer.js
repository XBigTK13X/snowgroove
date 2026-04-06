const recurse = require('recursive-readdir')
const _ = require('lodash')

const settings = require('./settings')
const util = require('./util')
const fileSystem = require('./file-system')

const MusicFile = require('./music-file')
const MusicAlbum = require('./music-album')
const MusicArtist = require('./music-artist')

class Organizer {
    constructor() {
        this.mediaRoot = settings.mediaRoot
        this.building = false
        this.startTime = null
        this.endTime = null
        this.rebuildCount = 0
        this.totalSongCount = 0
        this.durationLookup = null
        this.emptyThumbnailLookup = null
        this.randomWeightsLookup = null
        this.extractedCovers = {}
        this.coverArts = {
            list: [],
            lookup: {},
        }
        this.files = {
            list: [],
            lookup: {},
        }
        this.songs = {
            list: [],
            lookup: {},
        }
        this.albums = {
            list: [],
            lookup: {},
        }
        this.artists = {
            list: [],
            lookup: {},
        }
        this.categories = {
            list: [],
            lookup: {},
        }
        this.randomizer = {
            categories: [],
            artists: [],
            albums: [],
        }
    }

    status() {
        return {
            building: this.building,
            rebuildCount: this.rebuildCount,
            startTime: this.startTime,
            endTime: this.endTime,
            totalSongCount: this.totalSongCount,
        }
    }

    organize() {
        this.building = true
        this.rebuildCount = 0
        this.startTime = new Date()
        this.endTime = null
        this.totalSongCount = 0

        util.log(`Reading all files from media root.`)
        return new Promise(async (resolve, reject) => {
            await this.readLookups()
            await this.scanDirectory()
            await this.filter()
            await this.parseFilesToSongs()
            await this.sortSongs()
            await this.inspectFiles()
            await this.assignCoverArt()
            await this.organizeAlbums()
            await this.organizeCategories()
            await this.organizeArtists()
            await this.organizeRandomizer()

            let result = {
                songs: this.songs,
                albums: this.albums,
                artists: this.artists,
                categories: this.categories,
                randomizer: this.randomizer,
            }
            util.log(`Found [${this.songs.length}] songs across [${this.albums.length}] albums`)
            this.endTime = new Date()
            let timeSpent = (this.endTime.getTime() - this.startTime.getTime()) / 1000
            this.building = false
            util.log(`Finished organizing for catalog build in ${Math.floor(timeSpent / 60)} minutes and ${Math.floor(timeSpent % 60)} seconds`)
            resolve(result)
        })
    }

    async readLookups() {
        this.durationLookup = await fileSystem.readJsonFile(settings.durationLookupPath)
        this.emptyThumbnailLookup = await fileSystem.readJsonFile(settings.emptyThumbnailLookupPath)
        this.randomWeightsLookup = await fileSystem.readJsonFile(settings.randomWeightsPath)
    }

    scanDirectory() {
        return new Promise((resolve, reject) => {
            recurse(this.mediaRoot, (err, files) => {
                if (err) {
                    return reject(err)
                }
                this.files.list = files
                util.log(`Found ${this.files.list.length} files in the entire library`)
                resolve()
            })
        })
    }

    filter() {
        return new Promise((resolve) => {
            this.files.list = this.files.list.filter((file) => {
                if (file.includes('.snowgloo/thumbnails/')) {
                    if (file.includes('/embedded/')) {
                        let parts = file.split('/')
                        this.extractedCovers[parts[parts.length - 1].split('.')[0]] = file
                    }
                    return false
                }
                if (file.includes('.jpg') || file.includes('.png') || file.includes('.jpeg')) {
                    if (!file.toLowerCase().includes('small')) {
                        this.coverArts.list.push(new MusicFile(file))
                    }
                    return false
                }
                if (!file.includes('.mp3')) {
                    return false
                }
                return true
            })
            util.log(`Filtered down to ${this.files.list.length} songs to process`)
            resolve()
        })
    }

    parseFilesToSongs() {
        return new Promise((resolve) => {
            this.songs.list = this.files.list.map((file) => {
                let song = new MusicFile(file)
                if (_.has(this.songs.lookup, song.Id)) {
                    console.error('Duplicate song ID ' + song.LocalFilePath + ' and ' + this.songs.lookup[song.Id].LocalFilePath)
                }
                this.songs.lookup[song.Id] = song
                return song.Id
            })
            resolve()
        })
    }

    sortSongs() {
        return new Promise((resolve) => {
            this.songs.list = this.songs.list.sort((aId, bId) => {
                let a = this.songs.lookup[aId]
                let b = this.songs.lookup[bId]
                if (a.Artist.toLowerCase() !== b.Artist.toLowerCase()) {
                    return a.Artist.toLowerCase() > b.Artist.toLowerCase() ? 1 : -1
                }
                if (a.Album.toLowerCase() !== b.Album.toLowerCase()) {
                    return a.Album.toLowerCase() > b.Album.toLowerCase() ? 1 : -1
                }
                if (a.Disc !== b.Disc) {
                    return a.Disc > b.Disc ? 1 : -1
                }
                return a.Track > b.Track ? 1 : -1
            })
            resolve()
        })
    }

    inspectFiles() {
        return new Promise(async (resolve) => {
            this.rebuildCount = 0
            this.totalSongCount = this.songs.list.length
            const notify = 1000
            for (let ii = 0; ii < this.totalSongCount; ii++) {
                this.rebuildCount++
                if (this.rebuildCount === 1 || this.rebuildCount % notify === 0 || this.rebuildCount === this.totalSongCount) {
                    util.log(`Reading file ${this.rebuildCount} out of ${this.totalSongCount}`)
                }
                let songId = this.songs.list[ii]
                let embeddedCover = this.extractedCovers[songId]
                let duration = this.durationLookup[songId]
                let emptyCover = this.emptyThumbnailLookup[songId]
                this.songs.lookup[songId].populateMetadata(emptyCover ? null : embeddedCover, duration)
            }
            return resolve()
        })
    }

    assignCoverArt() {
        return new Promise((resolve) => {
            for (let coverArt of this.coverArts.list) {
                if (!_.has(this.coverArts.lookup, coverArt.AlbumSlug)) {
                    this.coverArts.lookup[coverArt.AlbumSlug] = coverArt.AudioUrl
                }
            }
            for (let songId of this.songs.list) {
                let song = this.songs.lookup[songId]
                if (_.has(this.coverArts.lookup, song.AlbumSlug)) {
                    song.AlbumCoverArt = this.coverArts.lookup[song.AlbumSlug]
                    song.ThumbnailCoverArt = util.nginxThumbnailPath(song.AlbumCoverArt, false)
                }
                song.CoverArt = song.EmbeddedCoverArt ? song.EmbeddedCoverArt : song.AlbumCoverArt
                song.ThumbnailCoverArt = util.nginxThumbnailPath(song.CoverArt, false)
                this.songs.lookup[songId] = song
            }
            resolve()
        })
    }

    organizeAlbums() {
        return new Promise((resolve) => {
            for (let songId of this.songs.list) {
                let song = this.songs.lookup[songId]
                if (!_.has(this.albums.lookup, song.AlbumSlug)) {
                    const album = new MusicAlbum(song, this.coverArts.lookup[song.AlbumSlug])
                    if (album.ReleaseYear === 9999) {
                        throw new Error(`Album has no defined year ${JSON.stringify(song)}`)
                    }
                    this.albums.lookup[song.AlbumSlug] = album
                    this.albums.list.push(song.AlbumSlug)
                }
                this.albums.lookup[song.AlbumSlug].Songs.push(song.Id)
            }
            this.albums.list = util.alphabetize(this.albums.list)
            resolve()
        })
    }

    organizeCategories() {
        return new Promise((resolve) => {
            for (let songId of this.songs.list) {
                let song = this.songs.lookup[songId]
                if (!_.has(this.categories.lookup, song.Kind)) {
                    this.categories.lookup[song.Kind] = {
                        artists: {
                            list: [],
                            lookup: {},
                        },
                    }
                    this.categories.list.push(song.Kind)
                }
                if (!_.has(this.categories.lookup[song.Kind].artists.lookup, song.Artist)) {
                    this.categories.lookup[song.Kind].artists.list.push(song.Artist)
                    this.categories.lookup[song.Kind].artists.lookup[song.Artist] = new MusicArtist(song)
                }
            }
            for (let category of this.categories.list) {
                this.categories.lookup[category].artists.list = util.alphabetize(this.categories.lookup[category].artists.list)
                this.categories.lookup[category].Kind = this.categories.lookup[category].artists.list.length === 1 && this.categories.lookup[category].artists.list[0] === category ? 'ArtistView' : 'ArtistList'
                this.categories.lookup[category].Name = category
            }
            this.categories.list = this.categories.list.sort()
            resolve()
        })
    }

    organizeArtists() {
        return new Promise((resolve) => {
            for (let category of this.categories.list) {
                for (let artist of this.categories.lookup[category].artists.list) {
                    let albums = _.cloneDeep(this.albums)
                    let albumList = albums.list
                        .filter((x) => {
                            return albums.lookup[x].Artist === artist
                        })
                        .sort((a, b) => {
                            if (albums.lookup[a].ReleaseYear === albums.lookup[b].ReleaseYear) {
                                if (albums.lookup[a].ReleaseYearSort === albums.lookup[b].ReleaseYearSort) {
                                    return albums.lookup[a].Album > albums.lookup[b].Album ? 1 : -1
                                }
                                return albums.lookup[a].ReleaseYearSort > albums.lookup[b].ReleaseYearSort ? 1 : -1
                            }
                            return albums.lookup[a].ReleaseYear > albums.lookup[b].ReleaseYear ? 1 : -1
                        })
                    let lists = {
                        Album: [],
                        Special: [],
                        Single: [],
                        Collab: [],
                    }
                    let albumLookup = albumList.reduce((result, next) => {
                        if (_.has(lists, albums.lookup[next].SubKind)) {
                            lists[albums.lookup[next].SubKind].push(next)
                        } else {
                            lists.Album.push(next)
                        }
                        let album = _.cloneDeep(albums.lookup[next])
                        album.Songs = album.Songs.map((songId) => {
                            return this.songs.lookup[songId]
                        })
                        result[next] = album
                        return result
                    }, {})
                    this.artists.list.push(artist)
                    this.artists.lookup[artist] = {
                        allAlbums: albumList,
                        lists: lists,
                        lookup: albumLookup,
                        listKinds: settings.sortKinds,
                    }
                }
            }
            resolve()
        })
    }

    organizeRandomizer() {
        return new Promise((resolve) => {
            this.randomizer.categories = this.categories.list.filter((category) => {
                return !_.has(this.randomWeightsLookup.CategorySlug, category) || this.randomWeightsLookup.CategorySlug[category] > 0
            })
            this.randomizer.artists = _.flatten(
                this.randomizer.categories.map((category) => {
                    return this.categories.lookup[category].artists.list.filter((artist) => {
                        return !_.has(this.randomWeightsLookup.ArtistSlug, artist) || this.randomWeightsLookup.ArtistSlug[artist] > 0
                    })
                })
            )
            this.randomizer.albums = _.flatten(
                this.randomizer.artists.map((artist) => {
                    return this.artists.lookup[artist].allAlbums.filter((album) => {
                        return !_.has(this.randomWeightsLookup.AlbumSlug, album) || this.randomWeightsLookup.AlbumSlug[album] > 0
                    })
                })
            )
            resolve()
        })
    }
}

module.exports = Organizer
