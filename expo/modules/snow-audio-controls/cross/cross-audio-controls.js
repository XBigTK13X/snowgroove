import LocalPlayer from './local-player'
import RemotePlayer from './remote-player'

export class CrossAudioControls {
    constructor() {
        this.eventEmitter = null
        this.apiClient = null
        this.targetPlayerId = null
        this.targetPlayerName = null
        this.player = null
        this.localPlayer = null
        this.remotePlayer = null
        this.playerState = { is_playing: false, position_seconds: 0, duration_seconds: 0, volume: 0.0 }
    }

    setEventEmitter(emitter) {
        this.eventEmitter = emitter
    }

    configure(apiClient, appConfig) {
        this.apiClient = apiClient
        this.config = appConfig
        this.eventEmitter.emit('apiConfigured')
        this.localPlayer = new LocalPlayer({
            eventEmitter: this.eventEmitter,
            onStateChange: (playerState) => {
                this.playerState = { ...this.playerState, ...playerState }
                this.eventEmitter.emit('statusUpdate', this.playerState)
            },
            onTrackFinished: () => {

            }
        })
        this.remotePlayer = new RemotePlayer({
            eventEmitter: this.eventEmitter,
            onStateChange: (playerState) => {
                this.playerState = { ...this.playerState, ...playerState }
                this.eventEmitter.emit('statusUpdate', this.playerState)
            },
            apiClient: this.apiClient
        })
    }

    changeTargetPlayer(id, name) {
        this.targetPlayerId = id
        this.targetPlayerName = name

        if (this.player !== null) {
            this.player.deactivate()
        }
        if (this.targetPlayerId !== null) {
            this.player = this.localPlayer
        } else {
            this.player = this.remotePlayer
        }
        this.player.activate({ id, name })
        this.apiClient.getMusicSession(this.targetPlayerId, this.targetPlayerName).then((session) => {
            this.localPlayer.setMusicSession(session)
            this.remotePlayer.setMusicSession(session)
            this.eventEmitter.emit('sessionChanged', session)
        })
    }

    play(audioFile) {
        if (this.config.debugAudioContext) this.eventEmitter.emit('log', { nativeOwner: 'CrossAudioControls->play', message: audioFile.web_path })
        this.player.play(audioFile)
    }

    pause() {
        if (this.config.debugAudioContext) this.eventEmitter.emit('log', { nativeOwner: 'CrossAudioControls->pause' })
        this.player.pause()
    }

    resume() {
        if (this.config.debugAudioContext) this.eventEmitter.emit('log', { nativeOwner: 'CrossAudioControls->resume' })
        this.player.resume()
    }

    stop() {
        if (this.config.debugAudioContext) this.eventEmitter.emit('log', { nativeOwner: 'CrossAudioControls->stop' })
        this.player.resume()
    }

    seek(seconds) {
        if (this.config.debugAudioContext) this.eventEmitter.emit('log', { nativeOwner: 'CrossAudioControls->seek', seconds })
        this.player.seek(seconds)
    }

    setVolume(percent) {
        if (this.config.debugAudioContext) this.eventEmitter.emit('log', { nativeOwner: 'CrossAudioControls->setVolume', percent })
        this.player.setVolume(percent)
    }
}

const Controls = new CrossAudioControls()

export default Controls