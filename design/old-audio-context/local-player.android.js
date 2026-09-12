import { AppState } from 'react-native'
import { SnowAudioControls } from '../../modules/snow-audio-controls'

export class LocalPlayer {
    constructor({ apiClient, onStateChange, onTrackFinished, initialVolume = 1.0 }) {
        this.apiClient = apiClient
        this.onStateChange = onStateChange
        this.onTrackFinished = onTrackFinished
        this.volume = initialVolume

        this.subscriptions = []
        this.appStateSubscription = null
        this.seekLockTimeout = null

        this.currentAudioFile = null
        this.positionSeconds = 0
        this.isNativeLoaded = false
    }

    updateConfig({ apiClient, onTrackFinished }) {
        this.apiClient = apiClient
        if (onTrackFinished) this.onTrackFinished = onTrackFinished
    }

    activate() {
        SnowAudioControls.setRemoteControlMode(false, this.volume, '', '', '')
        this.attachNativeListeners()

        this.appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active') {
                this.refreshSession()
            }
        })

        this.refreshSession()
    }

    deactivate() {
        this.detachNativeListeners()
        if (this.appStateSubscription) {
            this.appStateSubscription.remove()
            this.appStateSubscription = null
        }
        if (this.seekLockTimeout) {
            clearTimeout(this.seekLockTimeout)
            this.seekLockTimeout = null
        }
        this.isNativeLoaded = false
        this.pause()
    }

    attachNativeListeners() {
        this.detachNativeListeners()
        this.subscriptions.push(
            SnowAudioControls.addListener('statusUpdate', (status) => {
                if (!this.seekLockTimeout && status?.positionMillis !== undefined) {
                    const nextSeconds = status.positionMillis / 1000
                    if (Math.abs(this.positionSeconds - nextSeconds) >= 0.5) {
                        this.positionSeconds = nextSeconds
                        this.onStateChange?.({ positionSeconds: nextSeconds })
                    }
                }
            }),
            SnowAudioControls.addListener('finished', () => {
                this.handleSongEnded()
            })
        )
    }

    detachNativeListeners() {
        for (let ii = 0; ii < this.subscriptions.length; ii++) {
            this.subscriptions[ii].remove()
        }
        this.subscriptions = []
    }

    async handleSongEnded() {
        this.isNativeLoaded = false
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
                if (this.currentAudioFile?.id !== song?.id) {
                    this.isNativeLoaded = false
                }
                this.currentAudioFile = song
                patch.currentAudioFile = song
            }
            if (response.status?.volume !== undefined && response.status?.volume !== null) {
                const initialVolume = Math.max(0, Math.min(1, parseFloat(response.status.volume)))
                this.volume = initialVolume
                patch.volume = initialVolume
                SnowAudioControls.syncRemoteVolume(initialVolume)
            }
            if (response.status?.position !== undefined && response.status?.position !== null) {
                const initialPosition = parseFloat(response.status.position)
                if (!this.isNativeLoaded) {
                    this.positionSeconds = initialPosition
                    patch.positionSeconds = initialPosition
                }
            }
            this.onStateChange?.(patch)
        }
        return response
    }

    async play(audioFile, startingPosition = 0) {
        if (!audioFile) return
        this.currentAudioFile = audioFile
        this.positionSeconds = startingPosition

        this.onStateChange?.({
            currentAudioFile: audioFile,
            positionSeconds: startingPosition,
            isPlaying: true
        })

        const rawUri = audioFile.web_path
        const formattedUri = rawUri.includes('%') ? rawUri : encodeURI(rawUri)

        SnowAudioControls.setVolume(this.volume)
        SnowAudioControls.play({
            uri: formattedUri,
            title: audioFile.title || 'Unknown Title',
            artist: audioFile.artist || 'Unknown Artist',
            album: audioFile.album || 'Unknown Album',
            artworkUrl: audioFile.thumbnail_web_path || '',
            duration: audioFile.duration || 0
        })

        this.isNativeLoaded = true

        if (startingPosition > 0) {
            SnowAudioControls.seek(startingPosition)
        }
    }

    async pause() {
        SnowAudioControls.pause()
        this.onStateChange?.({ isPlaying: false })
    }

    async resume() {
        if (!this.currentAudioFile) return

        if (!this.isNativeLoaded) {
            await this.play(this.currentAudioFile, this.positionSeconds)
            return
        }

        SnowAudioControls.resume()
        this.onStateChange?.({ isPlaying: true })
    }

    async stop() {
        this.isNativeLoaded = false
        SnowAudioControls.stop()
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

        if (!this.isNativeLoaded && this.currentAudioFile) {
            await this.play(this.currentAudioFile, targetSeconds)
            return
        }

        SnowAudioControls.seek(targetSeconds)
    }

    async setVolume(percent) {
        this.volume = Math.max(0, Math.min(1, percent))
        this.onStateChange?.({ volume: this.volume })
        SnowAudioControls.setVolume(this.volume)
    }
}