import { VolumeManager } from 'react-native-volume-manager'

export class RemoteAudioHandler {
    constructor({ apiClient, targetPlayer, getSession, onStateSync, onVolumeChange }) {
        this.apiClient = apiClient
        this.targetPlayer = targetPlayer
        this.getSession = getSession
        this.onStateSync = onStateSync
        this.onVolumeChange = onVolumeChange
        this.pollInterval = null
        this.pendingVolumeTimeout = null
        this.volumeSubscription = null
        this.currentVolume = 1.0
        this.isActive = false
    }

    updateConfig({ apiClient, targetPlayer, getSession, onStateSync, onVolumeChange }) {
        this.apiClient = apiClient
        this.targetPlayer = targetPlayer
        if (getSession) this.getSession = getSession
        if (onStateSync) this.onStateSync = onStateSync
        if (onVolumeChange) this.onVolumeChange = onVolumeChange

        if (this.isActive && this.targetPlayer?.id && !this.pollInterval) {
            this.startPolling()
        }
    }

    getSessionId() {
        return this.getSession?.()?.id
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
        const sessionId = this.getSessionId()
        this.currentVolume = percent
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

    attachVolumeListener() {
        if (this.volumeSubscription) return

        let lastVolumeLevel = null
        VolumeManager.showNativeVolumeUI({ enabled: false })

        this.volumeSubscription = VolumeManager.addVolumeListener((event) => {
            if (lastVolumeLevel === null) {
                lastVolumeLevel = event.volume
                return
            }

            const difference = event.volume - lastVolumeLevel
            lastVolumeLevel = event.volume

            if (Math.abs(difference) > 0.001) {
                const targetVolume = Math.max(0, Math.min(1, this.currentVolume + difference))
                this.currentVolume = targetVolume
                this.onVolumeChange?.(targetVolume)
                this.setVolume(targetVolume)
            }
        })
    }

    detachVolumeListener() {
        if (this.volumeSubscription) {
            this.volumeSubscription.remove()
            this.volumeSubscription = null
            VolumeManager.showNativeVolumeUI({ enabled: true })
        }
    }

    activate() {
        this.isActive = true
        this.attachVolumeListener()
        this.startPolling()
    }

    deactivate() {
        this.isActive = false
        this.stopPolling()
        this.detachVolumeListener()
    }

    cleanup() {
        this.deactivate()
    }
}