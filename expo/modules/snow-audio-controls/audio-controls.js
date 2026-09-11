export class CrossAudioControls {
    constructor() {
        this.targetPlayerId = null
        this.targetPlayerName = null
    }
    changeTargetPlayer(id, name) {
        this.targetPlayerId = id
        this.targetPlayerName = name
    }
}

export default CrossAudioControls