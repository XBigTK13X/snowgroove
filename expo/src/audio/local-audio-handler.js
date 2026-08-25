import { SnowAudioControls } from '../../modules/snow-audio-controls'

export class LocalAudioHandler {
    constructor({ onStatusUpdate, onFinished }) {
        this.volume = 1.0
        this.onStatusUpdate = onStatusUpdate
        this.onFinished = onFinished
        this.subscriptions = []
        this.currentAudioFile = null

        this.attachListeners()
    }

    updateConfig({ onStatusUpdate, onFinished }) {
        if (onStatusUpdate) this.onStatusUpdate = onStatusUpdate
        if (onFinished) this.onFinished = onFinished
    }

    attachListeners() {
        this.detachListeners()

        this.subscriptions.push(
            SnowAudioControls.addListener('statusUpdate', (status) => {
                this.onStatusUpdate?.(status)
            }),
            SnowAudioControls.addListener('finished', () => {
                this.onFinished?.()
            })
        )
    }

    detachListeners() {
        for (let ii = 0; ii < this.subscriptions.length; ii++) {
            this.subscriptions[ii].remove()
        }
        this.subscriptions = []
    }

    async play(audioFile) {
        if (!audioFile) return
        this.currentAudioFile = audioFile

        const rawUri = audioFile.web_path
        const formattedUri = rawUri.includes('%') ? rawUri : encodeURI(rawUri)

        SnowAudioControls.play({
            uri: formattedUri,
            title: audioFile.title || 'Unknown Title',
            artist: audioFile.artist || 'Unknown Artist',
            album: audioFile.album || 'Unknown Album',
            artworkUrl: audioFile.thumbnail_web_path || '',
            duration: audioFile.duration || 0
        })
    }

    async pause() {
        SnowAudioControls.pause()
    }

    async resume() {
        if (this.currentAudioFile) {
            SnowAudioControls.resume()
        }
    }

    async stop() {
        SnowAudioControls.stop()
    }

    async seek(seconds) {
        SnowAudioControls.seek(seconds)
    }

    async setVolume(percent) {
        this.volume = Math.max(0, Math.min(1, percent))
        SnowAudioControls.setVolume(this.volume)
    }

    activate() { }

    deactivate() {
        this.pause()
    }

    async cleanup() {
        this.detachListeners()
        this.stop()
    }
}