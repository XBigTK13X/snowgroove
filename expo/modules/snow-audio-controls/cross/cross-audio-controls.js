import LocalPlayer from './local-player'
import RemotePlayer from './remote-player'

export class CrossAudioControls {
    constructor() {
        this.eventEmitter = null
        this.apiClient = null
        this.targetPlayerId = null
        this.targetPlayerName = null
        this.localPlayer = null
        this.remotePlayer = null
    }

    setEventEmitter(emitter) {
        this.eventEmitter = emitter
        this.localPlayer = new LocalPlayer({
            onStateChange: ({ currentAudioFile, positionSeconds, isPlaying }) => {

            },
            onTrackFinished: () => {

            }
        })
        this.remotePlayer = new RemotePlayer({
            onStateChange: ({ currentAudioFile, positionSeconds, isPlaying }) => {

            },
            apiClient: null
        })
    }

    configureApi(apiClient) {
        this.apiClient = apiClient
    }

    changeTargetPlayer(id, name) {
        this.targetPlayerId = id
        this.targetPlayerName = name
        this.apiClient.getMusicSession(this.targetPlayerId, this.targetPlayerName).then((session) => {
            this.eventEmitter.emit('sessionChanged', session)
        })
    }

    play(audioFile) {
        this.localPlayer.play(audioFile)
    }
}

const Controls = new CrossAudioControls()

export default Controls