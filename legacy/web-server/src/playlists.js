const path = require('path')
const database = require('./database')
const recurse = require('recursive-readdir')
const uuid = require('uuid').v4
const _ = require('lodash')
const settings = require('./settings')
const util = require('./util')

class Playlists {
    constructor() {
        this.databaseRoot = path.join(settings.databaseDirectory, 'playlist')
        this.catalog = null
        this.playlists = {
            lookup: {},
            list: [],
        }
        this.deletedPlaylists = {
            lookup: {},
            list: [],
        }
    }

    getDatabase(playlistId) {
        return database.getInstance(`playlist/${playlistId}`)
    }

    build(catalog) {
        return new Promise((resolve) => {
            this.catalog = catalog
            recurse(this.databaseRoot, (err, files) => {
                if (files && files.length) {
                    let readPromises = files.map((file) => {
                        let playlistId = file.split('/').pop().split('.')[0]
                        let database = this.getDatabase(playlistId)
                        return database.read()
                    })
                    Promise.all(readPromises).then((playlists) => {
                        for (let playlist of playlists) {
                            if (!playlist.deleted) {
                                this.playlists.lookup[playlist.id] = playlist
                                this.playlists.list.push(playlist)
                            } else {
                                this.deletedPlaylists.lookup[playlist.id] = playlist
                                this.deletedPlaylists.list.push(playlist)
                            }
                        }
                        this.playlists.list = this.playlists.list.sort((a, b) => {
                            return a.name > b.name ? 1 : -1
                        })
                        this.deletedPlaylists.list = this.deletedPlaylists.list.sort((a, b) => {
                            return a.name > b.name ? 1 : -1
                        })
                        util.log(`Loaded ${this.playlists.list.length} playlists from disk and ignored ${playlists.length - this.playlists.list.length} deleted playlists.`)
                    })
                }
            })
        })
    }

    write(playlist) {
        if (!playlist.id) {
            playlist.id = uuid()
        }

        if (playlist.songs.length) {
            playlist.songs = playlist.songs.map((song) => {
                if (song.Id) {
                    return song.Id
                } else {
                    return song
                }
            })
        }

        if (playlist.deleted) {
            delete this.playlists.lookup[playlist.id]
            for (let ii = 0; ii < this.playlists.list.length; ii++) {
                if (this.playlists.list[ii].id === playlist.id) {
                    this.playlists.list.splice(ii, 1)
                    break
                }
            }
            this.deletedPlaylists.lookup[playlist.id] = playlist
            this.deletedPlaylists.list.push(playlist)
        } else {
            delete this.deletedPlaylists.lookup[playlist.id]
            for (let ii = 0; ii < this.deletedPlaylists.list.length; ii++) {
                if (this.deletedPlaylists.list[ii].id === playlist.id) {
                    this.deletedPlaylists.list.splice(ii, 1)
                    break
                }
            }
            if (!_.has(this.playlists.lookup, playlist.id)) {
                this.playlists.list.push(playlist)
            } else {
                for (let ii = 0; ii < this.playlists.list.length; ii++) {
                    if (this.playlists.list[ii].id === playlist.id) {
                        this.playlists.list[ii] = playlist
                    }
                }
            }
            this.playlists.lookup[playlist.id] = playlist
            this.playlists.list = this.playlists.list.sort((a, b) => {
                return a.name > b.name ? 1 : -1
            })
        }
        return this.getDatabase(playlist.id)
            .write(playlist)
            .then(() => {
                return this.read(playlist.id)
            })
    }

    read(playlistId) {
        return new Promise((resolve) => {
            let playlist = { ...this.playlists.lookup[playlistId] }
            if (playlist && playlist.songs && playlist.songs.length) {
                this.catalog.getSongs(playlist.songs).then((songs) => {
                    playlist.songs = songs
                    resolve(playlist)
                })
            } else {
                resolve(playlist)
            }
        })
    }

    getM3U(playlistId){
        return new Promise((resolve)=>{
            this.read(playlistId)
            .then(playlist=>{
                let m3u = `#EXTM3U\n#PLAYLIST:${playlist.name}`
                playlist.songs = _.shuffle(playlist.songs)
                for(let song of playlist.songs){
                    m3u += util.m3uEntry(song)
                }
                return resolve(m3u)
            })
        })
    }

    readAll() {
        return this.playlists
    }

    getDeleted() {
        return this.deletedPlaylists.list
    }

    viewDeleted(playlistId) {
        return this.deletedPlaylists.lookup[playlistId]
    }

    add(playlistId, songId) {
        let playlist = { ...this.playlists.lookup[playlistId] }
        for (let song of playlist.songs) {
            if (song == songId) {
                return { success: false, error: 'Already in playlist' }
            }
        }
        playlist.songs.push(songId)
        return new Promise((resolve) => {
            this.getDatabase(playlist.id)
                .write(playlist)
                .then(() => {
                    resolve({ success: true })
                })
                .catch((err) => {
                    resolve({
                        success: false,
                        error: err,
                    })
                })
        })
    }
}

let instance
if (!instance) {
    instance = new Playlists()
}

module.exports = instance
