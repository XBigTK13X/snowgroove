export default class RemotePlayer {
    constructor({ eventEmitter, onStateChange, apiClient, config }) {
        this.eventEmitter = eventEmitter
        this.onStateChange = onStateChange
        this.apiClient = apiClient
        this.config = config
        this.musicSession = null
        this.remotePlayerId = null
        this.isActive = false
    }

    setMusicSession(session) {
        this.musicSession = session
    }

    activate({ id }) {
        this.remotePlayerId = id
        this.isActive = true
    }

    deactivate() {
        this.isActive = false
        this.remotePlayerId = null
    }

    async getStatus() {
        if (this.remotePlayerId === null || this.remotePlayerId === undefined) {
            return null
        }
        const status = await this.apiClient.getRemotePlayerStatus(this.remotePlayerId)
        if (status && this.isActive) {
            this.onStateChange(status)
        }
        return status
    }

    loadAndPlay() {
        const sessionId = this.musicSession?.id
        if (sessionId === null || sessionId === undefined) return
        this.apiClient.musicSessionPlay(sessionId)
    }

    play() {
        const sessionId = this.musicSession?.id
        if (sessionId === null || sessionId === undefined) return
        this.apiClient.musicSessionPlay(sessionId)
    }

    pause() {
        const sessionId = this.musicSession?.id
        if (sessionId === null || sessionId === undefined) return
        this.apiClient.musicSessionPause(sessionId)
    }

    resume() {
        const sessionId = this.musicSession?.id
        if (sessionId === null || sessionId === undefined) return
        this.apiClient.musicSessionPlay(sessionId)
    }

    stop() {
        const sessionId = this.musicSession?.id
        if (sessionId === null || sessionId === undefined) return
        this.apiClient.musicSessionStop(sessionId)
    }

    seek(seconds) {
        const sessionId = this.musicSession?.id
        if (sessionId === null || sessionId === undefined) return
        this.apiClient.musicSessionSeek(sessionId, seconds)
    }

    setVolume(volume) {
        const sessionId = this.musicSession?.id
        if (sessionId === null || sessionId === undefined) return
        this.apiClient.musicSessionVolume(sessionId, volume)
    }

    cleanup() {
        this.isActive = false
    }
}