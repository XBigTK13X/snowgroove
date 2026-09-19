import { createAudioPlayer } from 'expo-audio'

export class LocalPlayer {
    constructor({ onStateChange, onTrackFinished, initialVolume = 1.0, eventEmitter }) {
        this.onStateChange = onStateChange
        this.onTrackFinished = onTrackFinished
        this.volume = initialVolume

        this.seekLockTimeout = null

        this.player = null
        this.playerListener = null
        this.currentAudioFile = null
        this.positionSeconds = 0
    }

    activate({ targetPlayer }) {

    }

    deactivate() {
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
                    position_seconds: status.currentTime,
                    is_playing: status.playing
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
        }
    }

    async play(audioFile) {
        if (!audioFile) return
        this.currentAudioFile = audioFile
        this.positionSeconds = 0

        this.onStateChange?.({
            position_seconds: 0,
            is_playing: true
        })

        const rawUri = audioFile.web_path
        const formattedUri = rawUri.includes('%') ? rawUri : encodeURI(rawUri)

        this.setupWebPlayer(formattedUri)
        this.player.play()
    }

    async pause() {
        this.player?.pause()
        this.onStateChange?.({ is_playing: false })
    }

    async resume() {
        if (!this.currentAudioFile) return

        if (!this.player) {
            await this.play(this.currentAudioFile)
        } else {
            this.player.play()
            this.onStateChange?.({ is_playing: true })
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
        this.onStateChange?.({ is_playing: false })
    }

    async seek(seconds) {
        const duration = this.currentAudioFile?.duration || 0
        const targetSeconds = Math.max(0, Math.min(seconds, duration))
        this.positionSeconds = targetSeconds
        this.onStateChange?.({ position_seconds: targetSeconds })

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

export default LocalPlayer