import { AppState } from 'react-native'
import { SnowAudioControls } from '../../modules/snow-audio-controls'

export class RemotePlayer {
    constructor({ apiClient, onStateChange, initialVolume = 1.0 }) {
        this.apiClient = apiClient
        this.onStateChange = onStateChange
        this.volume = initialVolume

        this.targetPlayer = null
        this.currentSession = null
        this.pollInterval = null
        this.pendingVolumeTimeout = null
        this.appStateSubscription = null
    }

    updateConfig({ apiClient, targetPlayer }) {
        this.apiClient = apiClient
        this.targetPlayer = targetPlayer
    }

    activate({ targetPlayer }) {
        const targetChanged = this.targetPlayer?.id !== targetPlayer?.id
        this.targetPlayer = targetPlayer

        if (targetChanged) {
            this.currentSession = null
            this.onStateChange?.({
                isPlaying: false,
                currentAudioFile: null,
                positionSeconds: 0,
                musicSession: null
            })
        }

        SnowAudioControls.setRemoteControlMode(
            true,
            this.volume,
            this.apiClient?.baseURL || '',
            this.apiClient?.authToken || '',
            this.currentSession?.id || ''
        )

        this.startPolling()

        this.appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active') {
                this.refreshSession()
            }
        })

        this.refreshSession()
    }

    deactivate() {
        this.stopPolling()
        if (this.appStateSubscription) {
            this.appStateSubscription.remove()
            this.appStateSubscription = null
        }
    }

    cleanup() {
        this.deactivate()
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

    handleStateSync(response) {
        if (!response) return
        this.currentSession = response

        const patch = { musicSession: response }

        let currentSong = null
        if (response.music_queue?.songs?.length) {
            currentSong = response.music_queue.songs[response.music_queue.current_song_index]
            patch.currentAudioFile = currentSong
        }

        if (response.status?.position_seconds !== undefined) {
            patch.positionSeconds = response.status.position_seconds
        }

        if (response.status?.isPlaying !== undefined) {
            patch.isPlaying = response.status.isPlaying
        }

        if (response.status?.volume !== undefined && response.status?.volume !== null) {
            this.volume = Math.max(0, Math.min(1, parseFloat(response.status.volume)))
            patch.volume = this.volume
            SnowAudioControls.syncRemoteVolume(this.volume)
        }

        this.onStateChange?.(patch)

        if (currentSong) {
            SnowAudioControls.updateMetadata({
                title: currentSong.title || 'Unknown Title',
                artist: currentSong.artist || 'Unknown Artist',
                album: currentSong.album || 'Unknown Album',
                artworkUrl: currentSong.thumbnail_web_path || '',
                duration: currentSong.duration || 0,
                isPlaying: response.status?.isPlaying ?? false
            })
        }
    }

    async refreshSession() {
        if (!this.apiClient || !this.apiClient.isAuthenticated() || !this.targetPlayer?.id) return null

        const response = await this.apiClient.getMusicSession(this.targetPlayer.id, this.targetPlayer.name)
        if (response) {
            this.handleStateSync(response)
        }
        return response
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
        SnowAudioControls.syncRemoteVolume(this.volume)

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