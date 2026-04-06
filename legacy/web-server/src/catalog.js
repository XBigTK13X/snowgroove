const _ = require('lodash')

const settings = require('./settings')
const database = require('./database')
const util = require('./util')

const Organizer = require('./organizer')
const MusicFile = require('./music-file')
const MusicAlbum = require('./music-album')
const MusicArtist = require('./music-artist')
const playlists = require('./playlists')

class Catalog {
    constructor() {
        this.organizer = new Organizer()
        this.media = {}
        this.database = database.getInstance('catalog')
    }

    status() {
        return this.organizer.status()
    }

    build(force) {
        return new Promise(async (resolve) => {
            util.log('Reading catalog into memory')
            let persistedMedia = await this.database.read()
            if (!force && !this.database.isEmpty() && !settings.ignoreDatabaseCache) {
                util.log(`Using ${persistedMedia.songs.list.length} ingested songs from the database`)
                this.media = persistedMedia
                //Need to rehydrate class instances from JSON, otherwise instance methods won't work (i.e. search)
                let songsLookup = {}
                for (let songId of Object.keys(this.media.songs.lookup)) {
                    songsLookup[songId] = new MusicFile().rehydrate(this.media.songs.lookup[songId])
                }
                this.media.songs.lookup = songsLookup
                for (let albumName of this.media.albums.list) {
                    const album = new MusicAlbum().rehydrate(this.media.albums.lookup[albumName])
                    this.media.albums.lookup[albumName] = album
                }
                for (let category of this.media.categories.list) {
                    for (let artistName of this.media.categories.lookup[category].artists.list) {
                        const artist = new MusicArtist().rehydrate(this.media.categories.lookup[category].artists.lookup[artistName])
                        this.media.categories.lookup[category].artists.lookup[artistName] = artist
                    }
                }
                resolve(this.media)
            } else {
                util.log('Rebuilding the catalog from scratch')
                this.organizer = new Organizer(this.durationLookup, this.emptyThumbnailLookup)
                this.media = await this.organizer.organize()
                await this.database.write(this.media)
                util.log('Organized catalog persisted to disk')
                resolve(this.media)
            }
        })
    }

    search(query) {
        query = util.searchify(query)
        let maxItemCount = 25
        return new Promise((resolve) => {
            let results = {
                Songs: [],
                Artists: [],
                Albums: [],
                Playlists: { list: [] },
                ItemCount: 0,
            }
            let subCount = 0
            for (let songId of this.media.songs.list) {
                if (this.media.songs.lookup[songId].matches(query)) {
                    results.Songs.push(this.media.songs.lookup[songId])
                    results.ItemCount++
                    subCount += 1
                }
                if (subCount >= maxItemCount) {
                    break
                }
            }
            subCount = 0
            for (let albumSlug of this.media.albums.list) {
                const album = this.media.albums.lookup[albumSlug]
                if (album.matches(query)) {
                    let albumHit = _.cloneDeep(album)
                    albumHit.Songs = albumHit.Songs.map((songId) => {
                        return this.media.songs.lookup[songId]
                    })
                    results.Albums.push(albumHit)
                    results.ItemCount++
                    subCount += 1
                }
                if (subCount >= maxItemCount) {
                    break
                }
            }
            subCount = 0
            for (let category of this.media.categories.list) {
                for (let artistName of this.media.categories.lookup[category].artists.list) {
                    const artist = this.media.categories.lookup[category].artists.lookup[artistName]
                    if (artist.matches(query)) {
                        results.Artists.push(artist)
                        results.ItemCount++
                    }
                    subCount += 1
                }
                if (subCount >= maxItemCount) {
                    break
                }
            }
            subCount = 0
            for (let playlist of playlists.readAll().list) {
                if (util.searchify(playlist.name).includes(query)) {
                    results.Playlists.list.push(playlist)
                    results.ItemCount++
                    subCount += 1
                }
                if (subCount >= maxItemCount) {
                    break
                }
            }
            resolve(results)
        })
    }

    getCategories() {
        return new Promise((resolve) => {
            resolve(this.media.categories)
        })
    }

    getSongs(songIds) {
        return new Promise((resolve) => {
            if (!songIds) {
                return resolve(
                    this.media.songs.list.map((songId) => {
                        return this.media.songs.lookup[songId]
                    })
                )
            }

            return resolve(
                songIds
                    .map((songId) => {
                        return this.media.songs.lookup[songId]
                    })
                    .filter((x) => {
                        return !!x
                    })
            )
        })
    }

    getArtists(category) {
        return new Promise((resolve) => {
            if (!_.has(this.media.categories.lookup, category)) {
                return null
            }
            return resolve(this.media.categories.lookup[category].artists)
        })
    }

    getAlbum(albumSlug) {
        return new Promise((resolve) => {
            let album = _.cloneDeep(this.media.albums.lookup[albumSlug])
            album.Songs = album.Songs.map((songId) => {
                return this.media.songs.lookup[songId]
            })
            return resolve(album)
        })
    }

    getAlbums(artist) {
        return new Promise((resolve) => {
            if (!artist) {
                return resolve(this.media.albums)
            }

            return resolve(this.media.artists.lookup[artist])
        })
    }

    getRandomList() {
        return new Promise((resolve, reject) => {
            if (!this.media.randomizer.albums.length) {
                return reject(new Error('No albums present in library, or random-weights.json has disabled all content.'))
            }
            let randomCount = settings.randomListSize
            let maxAttempts = settings.randomListSize * 20
            let songs = []
            let artistDedupe = {}
            let albumDedupe = {}
            while (randomCount > 0 && maxAttempts > 0) {
                let album = this.media.albums.lookup[_.sample(this.media.randomizer.albums)]
                let song = this.media.songs.lookup[_.sample(album.Songs)]
                if (!_.has(artistDedupe, song.DisplayArtist) && !_.has(albumDedupe, song.DisplayAlbum)) {
                    artistDedupe[song.DisplayArtist] = 1
                    albumDedupe[song.DisplayAlbum] = 1
                    songs.push(song)
                    randomCount--
                }
                maxAttempts--
            }
            resolve(songs)
        })
    }
}

let instance

if (!instance) {
    instance = new Catalog()
}

module.exports = instance
