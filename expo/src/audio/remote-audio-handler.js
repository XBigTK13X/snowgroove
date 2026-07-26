export class RemoteAudioHandler {
    constructor({ apiClient, targetPlayer, onStateSync }) {
        this.apiClient = apiClient
        this.targetPlayer = targetPlayer
        this.onStateSync = onStateSync
        this.pollInterval = null
    }

    updateConfig({ apiClient, targetPlayer }) {
        this.apiClient = apiClient
        this.targetPlayer = targetPlayer
    }

    async play(sessionId) {
        if (this.apiClient && sessionId) {
            await this.apiClient.musicSessionPlay(sessionId)
        }
    }

    async pause(sessionId) {
        if (this.apiClient && sessionId) {
            await this.apiClient.musicSessionPause(sessionId)
        }
    }

    async stop(sessionId) {
        if (this.apiClient && sessionId) {
            await this.apiClient.musicSessionStop(sessionId)
        }
    }

    async seek(seconds, sessionId) {
        if (this.apiClient && sessionId) {
            await this.apiClient.musicSessionSeek(sessionId, seconds)
        }
    }

    async setVolume(percent, sessionId) {
        if (this.apiClient && sessionId) {
            await this.apiClient.musicSessionVolume(sessionId, percent * 100)
        }
    }

    startPolling() {
        if (!this.apiClient || !this.targetPlayer?.id || this.pollInterval) return

        const poll = () => {
            this.apiClient.getRemotePlayer(this.targetPlayer.id)
                .then(response => {
                    if (response?.status) {
                        this.onStateSync?.(response)
                    }
                })
        }
        poll()
        this.pollInterval = setInterval(poll, 1000)
    }

    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval)
            this.pollInterval = null
        }
    }

    cleanup() {
        this.stopPolling()
    }
}