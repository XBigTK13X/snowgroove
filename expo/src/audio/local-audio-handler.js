import { Audio } from 'expo-av'

export class LocalAudioHandler {
    constructor({ onStatusUpdate, onFinished }) {
        this.sound = null
        this.volume = 1.0
        this.onStatusUpdate = onStatusUpdate
        this.onFinished = onFinished
        this.loadingPromise = null
    }

    async loadAndPlay(audioFile) {
        await this.cleanup()

        const currentPromise = (async () => {
            const formattedUri = encodeURI(audioFile.web_path).replace(/#/g, '%23')
            const { sound: newSound } = await Audio.Sound.createAsync(
                { uri: formattedUri },
                { shouldPlay: true, volume: this.volume },
                this._handleStatusUpdate
            )

            // If a newer load was triggered while this was initializing, destroy this instance immediately
            if (this.loadingPromise !== currentPromise) {
                try {
                    await newSound.setOnPlaybackStatusUpdate(null)
                    await newSound.stopAsync()
                    await newSound.unloadAsync()
                } catch (swallow) { }
                return
            }

            this.sound = newSound
        })()

        this.loadingPromise = currentPromise
        await currentPromise
    }

    _handleStatusUpdate = (status) => {
        if (!status || !status.isLoaded) return
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
        if (this.sound) {
            await this.sound.pauseAsync()
            await this.sound.setPositionAsync(0)
        }
    }

    async seek(seconds) {
        if (this.sound) await this.sound.setPositionAsync(seconds * 1000)
    }

    async setVolume(percent) {
        this.volume = Math.max(0, Math.min(1, percent))
        if (this.sound) await this.sound.setVolumeAsync(this.volume)
    }

    async cleanup() {
        const soundToCleanup = this.sound
        this.sound = null
        this.loadingPromise = null

        if (soundToCleanup) {
            try {
                await soundToCleanup.setOnPlaybackStatusUpdate(null)
                await soundToCleanup.stopAsync()
                await soundToCleanup.unloadAsync()
            } catch (swallow) { }
        }
    }
}