import axios from 'axios'
import settings from '../settings'

class ApiClient {
    constructor() {
        this.httpClient = axios.create({
            baseURL: settings.webApiUrl,
            username: null,
        })
        this.baseURL = settings.webApiUrl
    }

    setUser(username) {
        this.username = username
    }

    get(url) {
        return this.httpClient.get(url).then((response) => {
            return response.data
        })
    }

    getCategories() {
        return this.get('category/list')
    }

    getSongs() {
        return this.get('song/list')
    }

    getAlbums() {
        return this.get('album/list')
    }

    getArtists(category) {
        return this.httpClient.get('artist/list', { params: { category } }).then((response) => {
            return response.data
        })
    }

    getArtist(artist) {
        return this.httpClient.get('artist/view', { params: { artist } }).then((response) => {
            return response.data
        })
    }

    getAlbum(albumSlug) {
        return this.httpClient.get('album/view', { params: { albumSlug } }).then((response) => {
            return response.data
        })
    }

    catalogStatus() {
        return this.get('catalog/build/status')
    }

    userList() {
        return this.get('user/list')
    }

    getQueue() {
        return this.get(`/queue/${this.username}`)
    }

    setQueue(queue) {
        return this.httpClient
            .post(`/queue/${this.username}`, {
                queue,
            })
            .then((response) => {
                return response.data
            })
    }

    systemInfo() {
        return this.get('/system/info')
    }

    search(query) {
        return this.httpClient.get('/search', { params: { query } }).then((response) => {
            return response.data
        })
    }

    getPlaylists() {
        return this.get(`/playlist/list`)
    }

    addToPlaylist(playlistId, songId) {
        return this.httpClient.post(`/playlist/add`, { playlistId: playlistId, songId: songId }).then((response) => {
            return response.data
        })
    }

    getPlaylist(playlistId) {
        return this.httpClient.get('/playlist/view', { params: { playlistId } }).then((response) => {
            return response.data
        })
    }

    savePlaylist(playlist) {
        return this.httpClient
            .post(`/playlist`, {
                playlist,
            })
            .then((response) => {
                return response.data
            })
    }

    catalogRebuild() {
        return this.httpClient.post('admin/catalog/build').then((response) => {
            return response.data
        })
    }

    clearQueues() {
        return this.httpClient.post('admin/queues/clear').then((response) => {
            return response.data
        })
    }

    getDeletedPlaylists() {
        return this.get('admin/playlists/deleted')
    }

    getLogs() {
        return this.get('/admin/log')
    }

    wipeLogs() {
        return this.httpClient.delete('/admin/log')
    }

    persistLogs() {
        return this.httpClient.post('/admin/log/persist')
    }

    getRandomList() {
        return this.get('/random/list')
    }
}

let instance

if (!instance) {
    instance = new ApiClient()
}

export default instance
