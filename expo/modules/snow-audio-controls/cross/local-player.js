import { createAudioPlayer } from 'expo-audio'

export default class LocalPlayer {
    constructor({ eventEmitter, onStateChange, onTrackFinished, config }) {
        this.eventEmitter = eventEmitter
        this.onStateChange = onStateChange
        this.onTrackFinished = onTrackFinished
        this.config = config
        this.audioPlayer = null
        this.statusSubscription = null
        this.hasFiredFinishedForCurrentItem = false
        this.targetVolume = 1.0
        this.musicSession = null
        this.isActive = false
    }

    setMusicSession(session) {
        this.musicSession = session
    }

    activate() {
        this.isActive = true
    }

    deactivate() {
        this.isActive = false
        this.pause()
    }

    prepare() {
        if (this.audioPlayer) {
            return
        }

        this.audioPlayer = createAudioPlayer()
        this.audioPlayer.volume = this.targetVolume

        this.statusSubscription = this.audioPlayer.addListener('playbackStatusUpdate', (status) => {
            if (!this.isActive) return

            if (status.didJustFinish) {
                if (!this.hasFiredFinishedForCurrentItem) {
                    this.hasFiredFinishedForCurrentItem = true
                    this.onTrackFinished()
                }
            }

            if (status.isLoaded && !status.didJustFinish) {
                this.hasFiredFinishedForCurrentItem = false
            }

            this.onStateChange({
                is_playing: Boolean(this.audioPlayer.playing),
                position_seconds: Math.floor(this.audioPlayer.currentTime || 0),
                duration_seconds: Math.floor(this.audioPlayer.duration || 0),
                volume: this.targetVolume,
                player_state: this.audioPlayer.playing ? 'playing' : 'paused'
            })
        })
    }

    async getStatus() {
        if (!this.audioPlayer) {
            return {
                is_playing: false,
                position_seconds: 0,
                duration_seconds: 0,
                volume: this.targetVolume,
                player_state: 'stopped'
            }
        }
        return {
            is_playing: Boolean(this.audioPlayer.playing),
            position_seconds: Math.floor(this.audioPlayer.currentTime || 0),
            duration_seconds: Math.floor(this.audioPlayer.duration || 0),
            volume: this.targetVolume,
            player_state: this.audioPlayer.playing ? 'playing' : 'paused'
        }
    }

    loadAndPlay(uri) {
        if (!uri) return
        this.hasFiredFinishedForCurrentItem = false
        this.prepare()

        try {
            this.audioPlayer.replace({ uri })
            this.audioPlayer.volume = this.targetVolume
            this.audioPlayer.play()
        } catch (exception) {
            if (this.config?.debugAudioContext) {
                this.eventEmitter.emit('error', {
                    nativeOwner: 'LocalPlayer->loadAndPlay',
                    message: 'Failed to load audio source',
                    exception: `${exception?.name || 'Error'} - ${exception?.message || String(exception)}`
                })
            }
        }
    }

    play(audioFile) {
        const uri = audioFile?.web_path || audioFile?.webPath
        if (uri) {
            this.loadAndPlay(uri)
        } else if (this.audioPlayer) {
            this.audioPlayer.play()
        }
    }

    pause() {
        if (this.audioPlayer) {
            this.audioPlayer.pause()
        }
    }

    resume() {
        if (this.audioPlayer) {
            this.audioPlayer.play()
        }
    }

    stop() {
        if (this.audioPlayer) {
            try {
                this.audioPlayer.pause()
                this.audioPlayer.seekTo(0)
            } catch (exception) {
                if (this.config?.debugAudioContext) {
                    this.eventEmitter.emit('error', {
                        nativeOwner: 'LocalPlayer->stop',
                        message: 'Failed to stop player',
                        exception: `${exception?.name || 'Error'} - ${exception?.message || String(exception)}`
                    })
                }
            }
        }
    }

    seek(seconds) {
        if (this.audioPlayer) {
            this.audioPlayer.seekTo(seconds)
        }
    }

    setVolume(volume) {
        this.targetVolume = volume
        if (this.audioPlayer) {
            this.audioPlayer.volume = volume
        }
    }

    cleanup() {
        if (this.statusSubscription) {
            this.statusSubscription.remove()
            this.statusSubscription = null
        }
        if (this.audioPlayer) {
            this.audioPlayer.remove()
            this.audioPlayer = null
        }
    }
}