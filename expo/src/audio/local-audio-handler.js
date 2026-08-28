import { Platform } from 'react-native'
import { createAudioPlayer } from 'expo-audio'
import { SnowAudioControls } from '../../modules/snow-audio-controls'

export class LocalAudioHandler {
    constructor({ onStatusUpdate, onFinished, initialVolume = 1.0 }) {
        this.volume = initialVolume
        this.onStatusUpdate = onStatusUpdate
        this.onFinished = onFinished
        this.subscriptions = []
        this.currentAudioFile = null
        this.player = null
        this.playerListener = null
        this.isWeb = Platform.OS === 'web'

        if (!this.isWeb) {
            this.attachListeners()
        }
    }

    updateConfig({ onStatusUpdate, onFinished, volume }) {
        if (onStatusUpdate) this.onStatusUpdate = onStatusUpdate
        if (onFinished) this.onFinished = onFinished
        if (volume !== undefined) this.volume = volume
    }

    attachListeners() {
        this.detachListeners()

        if (!this.isWeb) {
            this.subscriptions.push(
                SnowAudioControls.addListener('statusUpdate', (status) => {
                    this.onStatusUpdate?.(status)
                }),
                SnowAudioControls.addListener('finished', () => {
                    this.onFinished?.()
                })
            )
        }
    }

    detachListeners() {
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

            this.onStatusUpdate?.({
                positionMillis: status.currentTime * 1000,
                durationMillis: status.duration * 1000,
                isPlaying: status.playing,
                isLoaded: status.isLoaded
            })

            if (status.playbackState === 'ended') {
                this.onFinished?.()
            }
        })
    }

    async play(audioFile) {
        if (!audioFile) return
        this.currentAudioFile = audioFile

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
    }

    async resume() {
        if (this.currentAudioFile) {
            if (this.isWeb) {
                this.player?.play()
            } else {
                SnowAudioControls.resume()
            }
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
    }

    async seek(seconds) {
        if (this.isWeb) {
            if (this.player) {
                await this.player.seekTo(seconds)
            }
        } else {
            SnowAudioControls.seek(seconds)
        }
    }

    async setVolume(percent) {
        this.volume = Math.max(0, Math.min(1, percent))
        if (this.isWeb) {
            if (this.player) {
                this.player.volume = this.volume
            }
        } else {
            SnowAudioControls.setVolume(this.volume)
        }
    }

    activate() { }

    deactivate() {
        this.pause()
    }

    async cleanup() {
        this.detachListeners()
        await this.stop()
    }
}