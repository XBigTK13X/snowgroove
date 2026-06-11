import axios from 'axios'
import util from './util'
import Snow from 'expo-snowui'

const JOB_PROPERTIES = [
    ['targetKind', 'target_kind'],
    ['targetId', 'target_id'],
    ['targetDirectory', 'target_directory'],
    ['metadataId', 'metadata_id'],
    ['metadataSource', 'metadata_source'],
    ['seasonOrder', 'season_order'],
    ['episodeOrder', 'episode_order'],
    ['updateMetadata', 'update_metadata'],
    ['updateImages', 'update_images'],
    ['updateVideos', 'update_videos'],
    ['skipExisting', 'skip_existing'],
    ['extractOnly', 'extract_only'],
]

export class ApiClient {
    constructor(details) {
        this.webApiUrl = details.webApiUrl
        this.hasAdmin = details.isAdmin
        this.onApiError = details.onApiError
        this.onLogout = details.onLogout
        this.apiErrorSent = false
        this.createClient(details)
    }

    createClient = (details) => {
        this.baseURL = details.webApiUrl + '/api'
        this.authToken = details.authToken
        if (this.authToken) {
            this.httpClient = axios.create({
                baseURL: this.baseURL,
                headers: {
                    Authorization: 'Bearer ' + this.authToken,
                },
            })
        } else {
            this.httpClient = axios.create({
                baseURL: this.baseURL,
            })
        }
    }

    handleError = (err) => {
        util.log({ err })
        if (err) {
            if (err.response && err.response.status === 401) {
                this.onLogout?.()
            }
            try {
                let stringed = Snow.stringifySafe(err)
                if (stringed?.includes('401')) {
                    this.onLogout?.()
                }
            }
            catch (swallow) { }
            if (err?.code === 'ERR_NETWORK') {
                if (!this.apiErrorSent) {
                    this.onApiError(err)
                }
                this.apiErrorSent = true
            }
        }
    }

    get = async (url, params, silent) => {
        if (silent === undefined) {
            silent = true
        }
        let queryParams = null
        if (params) {
            queryParams = { params: params }
        }
        return this.httpClient
            .get(url, queryParams)
            .then((response) => {
                return response.data
            })
            .catch((err) => {
                this.handleError(err)
                if (silent === false) {
                    throw { err, url, payload }
                }
            })
    }

    post = async (url, payload, silent) => {
        if (silent === undefined) {
            silent = true
        }
        return this.httpClient
            .post(url, payload)
            .then((response) => {
                return response.data
            })
            .catch((err) => {
                this.handleError(err)
                if (silent === false) {
                    throw { err, url, payload }
                }
            })
    }

    delete = async (url) => {
        return this.httpClient
            .delete(url)
            .then((response) => {
                return response.data
            })
            .catch((err) => {
                this.handleError(err)
            })
    }

    isAuthenticated = () => {
        return this.authToken !== null
    }

    login = (payload) => {
        return new Promise(resolve => {
            return this.httpClient
                .postForm('/login', {
                    username: payload.username,
                    password: payload.password,
                    device_name: payload.deviceId,
                })
                .then((data) => {
                    if (data && data.data && data.data.access_token) {
                        this.authToken = data.data.access_token
                        this.permissions = data.data.permissions
                        this.hasAdmin = this.permissions.includes('admin')
                        this.createClient({ webApiUrl: this.webApiUrl, authToken: this.authToken })
                        this.displayName = data.data.display_name
                    }
                    return resolve({
                        authToken: this.authToken,
                        isAdmin: this.hasAdmin,
                        displayName: this.displayName
                    })
                })
                .catch((err) => {
                    return resolve({ failed: true, err: err })
                })
        })
    }

    heartbeat = () => {
        return this.get('/heartbeat')
    }

    createScopedJob = (name, details) => {
        let payload = { name }
        if (details) {
            payload.input = {}
            for (const prop of JOB_PROPERTIES) {
                if (details.hasOwnProperty(prop[0])) {
                    payload.input[prop[1]] = details[prop[0]]
                }
            }
        }
        return this.post('/job', payload)
    }

    createJobApplyDirectoryTag = (details) => { return this.createScopedJob('apply_directory_tag', details) }
    createJobCleanFileRecords = (details) => { return this.createScopedJob('clean_file_records', details) }
    createJobDeleteMediaRecords = (details) => { return this.createScopedJob('delete_media_records', details) }
    createJobReadMediaFiles = (details) => { return this.createScopedJob('read_media_files', details) }
    createJobShelvesScan = (details) => { return this.createScopedJob('scan_shelves_content', details) }
    createJobRemotePlayersScan = (details) => { return this.createScopedJob('scan_remote_players', details) }

    getJobList = (showComplete, limit) => {
        let query = `/job/list?show_complete=${showComplete}`
        if (limit) {
            query += `&limit=${limit}`
        }
        return this.get(query)
    }

    getJob = (jobId) => {
        return this.get(`/job?job_id=${jobId}`)
    }

    getLogPaths = () => {
        return this.get('/log/list')
    }

    getLog = (logIndex, logPath) => {
        if (logIndex !== undefined && logIndex !== null) {
            return this.get(`/log?log_index=${logIndex}`)
        }
        return this.get(`/log?transcode_log_path=${logPath}`)
    }

    saveShelf = (payload) => {
        return this.post('/shelf', payload, false)
    }

    deleteShelf = (shelfId) => {
        return this.delete(`/shelf/${shelfId}`)
    }

    getShelfList = () => {
        return this.get('/shelf/list')
    }

    getShelf = (shelfId) => {
        return this.get('/shelf', { shelf_id: shelfId })
    }

    getMovieList = (shelfId, showPlaylisted) => {
        return this.get('/movie/list', { shelf_id: shelfId, show_playlisted: showPlaylisted })
    }

    getMovie = (movieId, deviceProfile) => {
        return this.get(`/movie?movie_id=${movieId}&device_profile=${deviceProfile}`)
    }

    getShowList = (shelfId, showPlaylisted) => {
        return this.get('/show/list', { shelf_id: shelfId, show_playlisted: showPlaylisted })
    }

    getSeasonList = (showId) => {
        return this.get('/show/season/list', { show_id: showId })
    }

    getEpisodeList = (shelfId, seasonId) => {
        return this.get('/show/season/episode/list', { shelf_id: shelfId, show_season_id: seasonId })
    }

    getEpisode = (episodeId, deviceProfile) => {
        return this.get(`/show/season/episode?episode_id=${episodeId}&device_profile=${deviceProfile}`)
    }

    getUserList = (deviceName) => {
        return this.get(`/user/list?device_name=${deviceName}`)
    }

    getUser = (userId) => {
        return this.get('/user', { user_id: userId })
    }

    saveUser = (details) => {
        let payload = { ...details }
        if (details.password) {
            payload.raw_password = details.password
            payload.set_password = true
            delete payload.password
        }
        return this.post('/user', payload, false)
    }

    deleteUser = (userId) => {
        return this.delete(`/user/${userId}`)
    }

    saveUserAccess = (payload) => {
        return this.post('/user/access', {
            user_id: payload.userId,
            tag_ids: payload.tagIds,
            shelf_ids: payload.shelfIds,
        }, false)
    }

    getTag = (tagId) => {
        return this.get('/tag', { tag_id: tagId })
    }

    getTagList = () => {
        return this.get('/tag/list')
    }

    saveTag = (payload) => {
        return this.post('/tag', payload, false)
    }

    deleteTag = (tagId) => {
        return this.delete(`/tag/${tagId}`)
    }

    getDeviceProfileList = () => {
        return this.get('/device/profile/list')
    }

    search = (query) => {
        return this.get('/search', { query })
    }

    getPlaylistList = () => {
        return this.get('/playlist/list')
    }

    getPlaylist = (tagId) => {
        return this.get('/playlist', { tag_id: tagId })
    }

    getCrate = (shelfId, crateId) => {
        let url = `/crate?shelf_id=${shelfId}`
        if (crateId) {
            url += `&crate_id=${crateId}`
        }
        return this.get(url)
    }

    getRemotePlayerList = () => {
        return this.get('/remote-player/list')
    }

    getRemotePlayer = (remotePlayerId) => {
        return this.get(`/remote-player?remote_player_id=${remotePlayerId}`)
    }

    getMusicSession = (remotePlayerId) => {
        let url = `/music-session`
        if (remotePlayerId) {
            url += `?remote_player_id=${remotePlayerId}`
        }
        return this.get(url)
    }

    updateMusicSessionMusicQueue = (musicSessionId, musicQueue) => {
        return this.post('/music-queue', { music_queue: musicQueue, music_session_id: musicSessionId })
    }

    getSessionList = () => {
        return this.get('/session/list')
    }

    deleteAllCachedText = () => {
        return this.delete('/cached/text')
    }

    getDisplayCleanupRuleList = () => {
        return this.get('/display-cleanup-rule/list')
    }

    getDisplayCleanupRule = (ruleId) => {
        return this.get(`/display-cleanup-rule?rule_id=${ruleId}`)
    }

    saveDisplayCleanupRule = (rule) => {
        return this.post('/display-cleanup-rule', rule, false)
    }

    deleteDisplayCleanupRule = (ruleId) => {
        return this.delete(`/display-cleanup-rule?rule_id=${ruleId}`)
    }

    getTagRuleList = () => {
        return this.get('/tag-rule/list')
    }

    getTagRule = (ruleId) => {
        return this.get(`/tag-rule?rule_id=${ruleId}`)
    }

    saveTagRule = (rule) => {
        return this.post('/tag-rule', rule, false)
    }

    deleteTagRule = (ruleId) => {
        return this.delete(`/tag-rule?rule_id=${ruleId}`)
    }

    debug = () => {
        util.log({ baseURL: this.baseURL, authToken: this.authToken })
    }
}

export default ApiClient
