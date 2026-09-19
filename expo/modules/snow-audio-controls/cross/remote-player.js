import { AppState } from 'react-native'

export class RemotePlayer {
    constructor({ apiClient, onStateChange, initialVolume = 1.0 }) {
        this.apiClient = apiClient
        this.onStateChange = onStateChange
        this.volume = initialVolume

        this.targetPlayer = null
        this.pollInterval = null
        this.pendingVolumeTimeout = null
    }


    activate({ targetPlayer }) {
        const targetChanged = this.targetPlayer?.id !== targetPlayer?.id
        this.targetPlayer = targetPlayer

        if (targetChanged) {
            this.currentSession = null
            this.onStateChange?.({
                is_playing: false,
                position_seconds: 0
            })
        }

        this.startPolling()
    }

    deactivate() {
        this.stopPolling()
    }

    startPolling() {
        if (!this.apiClient || !this.targetPlayer?.id || this.pollInterval) return

        const pollProgress = () => {
            this.apiClient.getRemotePlayer(this.targetPlayer.id)
                .then((response) => {
                    if (response && response.status) {
                        this.handleStateSync(response)
                    }
                })
                .catch((error) => {
                    const statusCode = error?.status || error?.response?.status
                    if (statusCode === 401) {
                        this.stopPolling()
                    }
                })
        }

        pollProgress()
        this.pollInterval = setInterval(pollProgress, 1000)
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

    handleStateSync() {
        const patch = {}

        if (response.status?.position_seconds !== undefined) {
            patch.positionSeconds = response.status.position_seconds
        }

        if (response.status?.is_playing !== undefined) {
            patch.is_playing = response.status.is_playing
        }

        if (response.status?.volume !== undefined && response.status?.volume !== null) {
            this.volume = Math.max(0, Math.min(1, parseFloat(response.status.volume)))
            patch.volume = this.volume
        }

        this.onStateChange?.(patch)
    }

    getSessionId() {
        return this.currentSession?.id
    }

    async play(audioFile) {
        const sessionId = this.getSessionId()
        if (this.apiClient && sessionId) {
            await this.apiClient.musicSessionPlay(sessionId)
        }
    }

    async pause() {
        const sessionId = this.getSessionId()
        if (this.apiClient && sessionId) {
            await this.apiClient.musicSessionPause(sessionId)
        }
    }

    async resume() {
        const sessionId = this.getSessionId()
        if (this.apiClient && sessionId) {
            await this.apiClient.musicSessionPlay(sessionId)
        }
    }

    async stop() {
        const sessionId = this.getSessionId()
        if (this.apiClient && sessionId) {
            await this.apiClient.musicSessionStop(sessionId)
        }
    }

    async seek(seconds) {
        const sessionId = this.getSessionId()
        if (this.apiClient && sessionId) {
            await this.apiClient.musicSessionSeek(sessionId, seconds)
        }
    }

    async setVolume(percent) {
        this.volume = Math.max(0, Math.min(1, percent))
        this.onStateChange?.({ volume: this.volume })

        const sessionId = this.getSessionId()
        if (!this.apiClient || !sessionId) return

        if (this.pendingVolumeTimeout) clearTimeout(this.pendingVolumeTimeout)
        this.pendingVolumeTimeout = setTimeout(async () => {
            try {
                await this.apiClient.musicSessionVolume(sessionId, this.volume)
            } catch (error) {
                console.error('Failed to sync remote volume:', error)
            }
        }, 100)
    }
}

export default RemotePlayer