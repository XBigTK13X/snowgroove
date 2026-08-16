export class RemoteAudioHandler {
    constructor({ apiClient, targetPlayer, onStateSync }) {
        this.apiClient = apiClient
        this.targetPlayer = targetPlayer
        this.onStateSync = onStateSync
        this.pollInterval = null
        this.pendingVolumeTimeout = null
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

    async resume(sessionId) {
        if (this.apiClient && sessionId) {
            await this.apiClient.musicSessionPlay(sessionId)
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
        if (!this.apiClient || !sessionId) return

        if (this.pendingVolumeTimeout) {
            clearTimeout(this.pendingVolumeTimeout)
        }

        this.pendingVolumeTimeout = setTimeout(async () => {
            try {
                await this.apiClient.musicSessionVolume(sessionId, percent)
            } catch (error) {
                console.error('Failed to sync remote volume:', error)
            }
        }, 150)
    }

    startPolling() {
        if (!this.apiClient || !this.targetPlayer?.id || this.pollInterval) {
            return
        }

        const pollRemotePlaybackProgress = () => {
            this.apiClient.getRemotePlayer(this.targetPlayer.id)
                .then((response) => {
                    if (response && response.status) {
                        this.onStateSync?.(response)
                    }
                })
                .catch(() => { })
        }

        pollRemotePlaybackProgress()
        this.pollInterval = setInterval(pollRemotePlaybackProgress, 1000)
    }

    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval)
            this.pollInterval = null
        }
        if (this.pendingVolumeTimeout) {
            clearTimeout(this.pendingVolumeTimeout)
            this.pendingVolumeTimeout = null
        }
    }

    cleanup() {
        this.stopPolling()
    }
}