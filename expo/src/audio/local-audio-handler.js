import { Audio } from 'expo-av'

export class LocalAudioHandler {
    constructor({ onStatusUpdate, onFinished }) {
        this.sound = null
        this.volume = 1.0
        this.onStatusUpdate = onStatusUpdate
        this.onFinished = onFinished
    }

    async loadAndPlay(audioFile) {
        await this.cleanup()

        const formattedUri = encodeURI(audioFile.web_path).replace(/#/g, '%23')
        const { sound: newSound } = await Audio.Sound.createAsync(
            { uri: formattedUri },
            { shouldPlay: true, volume: this.volume },
            this._handleStatusUpdate
        )
        this.sound = newSound
    }

    _handleStatusUpdate = (status) => {
        if (!status.isLoaded) return
        this.onStatusUpdate?.(status)
        if (status.didJustFinish) {
            this.onFinished?.()
        }
    }

    async pause() {
        if (this.sound) await this.sound.pauseAsync()
    }

    async resume() {
        if (this.sound) await this.sound.playAsync()
    }

    async stop() {
        if (this.sound) await this.sound.pauseAsync()
    }

    async seek(seconds) {
        if (this.sound) await this.sound.setPositionAsync(seconds * 1000)
    }

    async setVolume(percent) {
        this.volume = Math.max(0, Math.min(1, percent))
        if (this.sound) await this.sound.setVolumeAsync(this.volume)
    }

    async cleanup() {
        if (this.sound) {
            try {
                await this.sound.stopAsync()
                await this.sound.unloadAsync()
            } catch (swallow) { }
            this.sound = null
        }
    }
}