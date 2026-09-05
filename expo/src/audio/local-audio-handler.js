import { Platform, AppState } from 'react-native'
import { createAudioPlayer } from 'expo-audio'
import { SnowAudioControls } from '../../modules/snow-audio-controls'

export class LocalAudioHandler {
    constructor({ apiClient, onStateChange, onTrackFinished, initialVolume = 1.0 }) {
        this.apiClient = apiClient
        this.onStateChange = onStateChange
        this.onTrackFinished = onTrackFinished
        this.volume = initialVolume
        this.isWeb = Platform.OS === 'web'

        this.subscriptions = []
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
        SnowAudioControls.setRemoteControlMode(false, this.volume, '', '', '')

        if (!this.isWeb) {
            this.attachNativeListeners()
        }

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
        this.pause()
    }

    cleanup() {
        this.deactivate()
        this.stop()
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
                SnowAudioControls.syncRemoteVolume(initialVolume)
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

        if (this.isWeb) {
            this.setupWebPlayer(formattedUri)
            this.player.play()
        } else {
            SnowAudioControls.setVolume(this.volume)
            SnowAudioControls.play({
                uri: formattedUri,
                title: audioFile.title || 'Unknown Title',
                artist: audioFile.artist || 'Unknown Artist',
                album: audioFile.album || 'Unknown Album',
                artworkUrl: audioFile.thumbnail_web_path || '',
                duration: audioFile.duration || 0
            })
        }
    }

    async pause() {
        if (this.isWeb) {
            this.player?.pause()
        } else {
            SnowAudioControls.pause()
        }
        this.onStateChange?.({ isPlaying: false })
    }

    async resume() {
        if (!this.currentAudioFile) return

        if (this.isWeb) {
            if (!this.player) {
                await this.play(this.currentAudioFile)
            } else {
                this.player.play()
                this.onStateChange?.({ isPlaying: true })
            }
        } else {
            SnowAudioControls.resume()
            this.onStateChange?.({ isPlaying: true })
        }
    }

    async stop() {
        if (this.isWeb) {
            if (this.playerListener) {
                this.playerListener.remove()
                this.playerListener = null
            }
            if (this.player) {
                this.player.pause()
                this.player.release()
                this.player = null
            }
        } else {
            SnowAudioControls.stop()
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

        if (this.isWeb) {
            if (this.player) await this.player.seekTo(targetSeconds)
        } else {
            SnowAudioControls.seek(targetSeconds)
        }
    }

    async setVolume(percent) {
        this.volume = Math.max(0, Math.min(1, percent))
        this.onStateChange?.({ volume: this.volume })

        if (this.isWeb) {
            if (this.player) this.player.volume = this.volume
        } else {
            SnowAudioControls.setVolume(this.volume)
        }
    }
}