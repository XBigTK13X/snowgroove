import { AppState } from 'react-native'
import { createAudioPlayer } from 'expo-audio'

export class LocalPlayer {
    constructor({ apiClient, onStateChange, onTrackFinished, initialVolume = 1.0 }) {
        this.apiClient = apiClient
        this.onStateChange = onStateChange
        this.onTrackFinished = onTrackFinished
        this.volume = initialVolume

        this.appStateSubscription = null
        this.seekLockTimeout = null

        this.player = null
        this.playerListener = null
        this.currentAudioFile = null
        this.positionSeconds = 0
    }

    updateConfig({ apiClient, onTrackFinished }) {
        this.apiClient = apiClient
        if (onTrackFinished) this.onTrackFinished = onTrackFinished
    }

    activate() {
        this.appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active') {
                this.refreshSession()
            }
        })

        this.refreshSession()
    }

    deactivate() {
        if (this.appStateSubscription) {
            this.appStateSubscription.remove()
            this.appStateSubscription = null
        }
        if (this.seekLockTimeout) {
            clearTimeout(this.seekLockTimeout)
            this.seekLockTimeout = null
        }
        this.pause()
    }

    setupWebPlayer(uri) {
        if (this.playerListener) {
            this.playerListener.remove()
            this.playerListener = null
        }

        if (this.player) {
            this.player.release()
            this.player = null
        }

        this.player = createAudioPlayer(uri)
        this.player.volume = this.volume

        this.playerListener = this.player.addListener('playbackStatusUpdate', (status) => {
            if (!status.isLoaded) return

            if (!this.seekLockTimeout && status.currentTime !== undefined) {
                this.positionSeconds = status.currentTime
                this.onStateChange?.({
                    positionSeconds: status.currentTime,
                    isPlaying: status.playing
                })
            }

            if (status.playbackState === 'ended') {
                this.handleSongEnded()
            }
        })
    }

    async handleSongEnded() {
        if (this.onTrackFinished) {
            await this.onTrackFinished()
        } else {
            await this.refreshSession()
        }
    }

    async refreshSession() {
        if (!this.apiClient || !this.apiClient.isAuthenticated()) {
            return null
        }

        const response = await this.apiClient.getMusicSession()
        if (response) {
            const patch = { musicSession: response }
            if (response.music_queue?.songs?.length) {
                const song = response.music_queue.songs[response.music_queue.current_song_index]
                this.currentAudioFile = song
                patch.currentAudioFile = song
            }
            if (response.status?.volume !== undefined && response.status?.volume !== null) {
                const initialVolume = Math.max(0, Math.min(1, parseFloat(response.status.volume)))
                this.volume = initialVolume
                patch.volume = initialVolume
            }
            this.onStateChange?.(patch)
        }
        return response
    }

    async play(audioFile) {
        if (!audioFile) return
        this.currentAudioFile = audioFile
        this.positionSeconds = 0

        this.onStateChange?.({
            currentAudioFile: audioFile,
            positionSeconds: 0,
            isPlaying: true
        })

        const rawUri = audioFile.web_path
        const formattedUri = rawUri.includes('%') ? rawUri : encodeURI(rawUri)

        this.setupWebPlayer(formattedUri)
        this.player.play()
    }

    async pause() {
        this.player?.pause()
        this.onStateChange?.({ isPlaying: false })
    }

    async resume() {
        if (!this.currentAudioFile) return

        if (!this.player) {
            await this.play(this.currentAudioFile)
        } else {
            this.player.play()
            this.onStateChange?.({ isPlaying: true })
        }
    }

    async stop() {
        if (this.playerListener) {
            this.playerListener.remove()
            this.playerListener = null
        }
        if (this.player) {
            this.player.pause()
            this.player.release()
            this.player = null
        }
        this.onStateChange?.({ isPlaying: false })
    }

    async seek(seconds) {
        const duration = this.currentAudioFile?.duration || 0
        const targetSeconds = Math.max(0, Math.min(seconds, duration))
        this.positionSeconds = targetSeconds
        this.onStateChange?.({ positionSeconds: targetSeconds })

        if (this.seekLockTimeout) clearTimeout(this.seekLockTimeout)
        this.seekLockTimeout = setTimeout(() => {
            this.seekLockTimeout = null
        }, 1200)

        if (this.player) await this.player.seekTo(targetSeconds)
    }

    async setVolume(percent) {
        this.volume = Math.max(0, Math.min(1, percent))
        this.onStateChange?.({ volume: this.volume })

        if (this.player) this.player.volume = this.volume
    }
}