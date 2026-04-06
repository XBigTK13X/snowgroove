const settings = require('./settings')
const catalog = require('./catalog')
const musicQueue = require('./music-queue')
const playlists = require('./playlists')
const log = require('./log')
const util = require('./util')

const register = (router) => {
    router.get('/api/category/list', async (request, response) => {
        let result = await catalog.getCategories()
        response.send(result)
    })
    router.get('/api/song/list', async (request, response) => {
        response.send(await catalog.getSongs())
    })
    router.get('/api/album/list', async (request, response) => {
        let result = {
            albums: await catalog.getAlbums(),
        }
        response.send(result)
    })
    router.get('/api/artist/list', async (request, response) => {
        response.send(await catalog.getArtists(request.query.category))
    })
    router.get('/api/artist/view', async (request, response) => {
        let result = {
            albums: await catalog.getAlbums(decodeURIComponent(request.query.artist)),
            artist: request.query.artist,
        }
        response.send(result)
    })
    router.get('/api/album/view', async (request, response) => {
        let result = {
            album: await catalog.getAlbum(decodeURIComponent(request.query.albumSlug)),
        }
        response.send(result)
    })

    router.get('/api/catalog/build/status', async (request, response) => {
        response.send(catalog.status())
    })

    router.get('/api/user/list', async (request, response) => {
        response.send({
            users: settings.userList,
        })
    })

    router.get('/api/queue/:username', async (request, response) => {
        response.send(await musicQueue.read(request.params.username))
    })

    router.post('/api/queue/:username', async (request, response) => {
        response.send({
            queue: await musicQueue.write(request.params.username, request.body.queue),
        })
    })

    router.delete('/api/queue/:username', async (request, response) => {
        response.send(await musicQueue.clear(request.params.username))
    })

    router.get('/api/system/info', async (request, response) => {
        response.send({
            version: settings.serverVersion,
            buildDate: settings.buildDate,
        })
    })

    router.get('/api/search', async (request, response) => {
        response.send(await catalog.search(request.query.query))
    })

    router.post('/api/playlist', async (request, response) => {
        response.send(await playlists.write(request.body.playlist))
    })

    router.get('/api/playlist/view', async (request, response) => {
        response.send(await playlists.read(request.query.playlistId))
    })

    router.post('/api/playlist/add', async (request, response) => {
        response.send(await playlists.add(request.body.playlistId, request.body.songId))
    })

    router.get('/api/playlist/list', async (request, response) => {
        response.send(await playlists.readAll())
    })

    router.post('/api/admin/catalog/build', async (request, response) => {
        catalog.build(true)
        response.send('Building')
    })

    router.post('/api/admin/queues/clear', async (request, response) => {
        musicQueue.clearAll()
        response.send('Cleared')
    })

    router.get('/api/admin/playlists/deleted', async (request, response) => {
        response.send({
            playlists: await playlists.getDeleted(),
        })
    })

    router.get('/api/admin/playlist/deleted', async (request, response) => {
        response.send({
            playlists: await playlists.viewDeleted(request.query.playlistId),
        })
    })

    router.post('/api/admin/log', async (request, response) => {
        let memoryLog = log.getInstance(`${request.body.clientId}`)
        response.send(await memoryLog.write(request.body.message))
    })

    router.get('/api/admin/log', async (request, response) => {
        response.send({
            logs: log.getAll(),
        })
    })

    router.post('/api/admin/log/persist', (request, response) => {
        log.persistAll().then(() => {
            response.send({})
        })
    })

    router.delete('/api/admin/log', (request, response) => {
        log.wipeAll()
        response.send({})
    })

    router.get('/api/random/list', async (request, response) => {
        response.send({
            songs: await catalog.getRandomList(),
        })
    })

    router.get('/api/queue/:username/playlist.m3u', async (request, response) => {
        response.setHeader('content-type', 'text/plain')
        response.send(await musicQueue.getM3U(request.params.username))
    })

    router.get('/api/playlist/:playlistId/playlist.m3u', async (request, response) => {
        response.setHeader('content-type', 'text/plain');
        response.send(await playlists.getM3U(request.params.playlistId))
    })
}

module.exports = {
    register,
}
