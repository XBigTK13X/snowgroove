import { createAudioPlayer } from 'expo-audio'

export class LocalAudioHandler {
    constructor({ onStatusUpdate, onFinished }) {
        this.player = null
        this.volume = 1.0
        this.onStatusUpdate = onStatusUpdate
        this.onFinished = onFinished
        this.statusSubscription = null
        this.currentAudioFile = null
    }

    updateConfig({ onStatusUpdate, onFinished }) {
        if (onStatusUpdate) this.onStatusUpdate = onStatusUpdate
        if (onFinished) this.onFinished = onFinished
    }

    attachListeners(targetPlayer) {
        if (this.statusSubscription) {
            this.statusSubscription.remove()
            this.statusSubscription = null
        }

        this.statusSubscription = targetPlayer.addListener('playbackStatusUpdate', (status) => {
            if (!status) return

            this.onStatusUpdate?.({
                positionMillis: (status.currentTime || 0) * 1000,
                isLoaded: status.isLoaded,
                isPlaying: status.isPlaying
            })

            if (status.didJustFinish) {
                this.onFinished?.()
            }
        })
    }

    async play(audioFile) {
        if (!audioFile) return
        this.currentAudioFile = audioFile
        const rawUri = audioFile.web_path
        const formattedUri = rawUri.includes('%') ? rawUri : encodeURI(rawUri)

        const lockScreenMetadata = {
            title: audioFile.title || 'Unknown Title',
            artist: audioFile.artist || 'Unknown Artist',
            albumTitle: audioFile.album || 'Unknown Album',
            artworkUrl: audioFile.thumbnail_web_path || undefined
        }

        if (this.player) {
            this.player.setActiveForLockScreen(true, lockScreenMetadata)
            await this.player.replace({ uri: formattedUri })
            this.player.play()
            return
        }

        const newPlayer = createAudioPlayer({ uri: formattedUri })
        newPlayer.volume = this.volume

        this.attachListeners(newPlayer)
        this.player = newPlayer

        this.player.setActiveForLockScreen(true, lockScreenMetadata)
        this.player.play()
    }

    async pause() {
        if (this.player) this.player.pause()
    }

    async resume() {
        if (this.player) {
            this.player.play()
        } else if (this.currentAudioFile) {
            await this.play(this.currentAudioFile)
        }
    }

    async stop() {
        if (this.player) {
            this.player.pause()
            this.player.seekTo(0)
            this.player.setActiveForLockScreen(false)
        }
    }

    async seek(seconds) {
        if (this.player) this.player.seekTo(seconds)
    }

    async setVolume(percent) {
        this.volume = Math.max(0, Math.min(1, percent))
        if (this.player) this.player.volume = this.volume
    }

    activate() { }

    deactivate() {
        this.pause()
    }

    async cleanup() {
        if (this.statusSubscription) {
            this.statusSubscription.remove()
            this.statusSubscription = null
        }

        if (this.player) {
            try {
                this.player.setActiveForLockScreen(false)
                this.player.pause()
                this.player.release()
            } catch (swallow) { }
            this.player = null
        }
    }
}