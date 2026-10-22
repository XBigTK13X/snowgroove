class Config {
    constructor() {
        this.vondoomWebApiUrl = 'http://192.168.101.10:10063' // Desktop
        this.beastWebApiUrl = 'http://beast.9914.us:10063' // Prod

        this.clientVersion = "1.4.2"
        this.clientBuildDate = "October 21, 2026"
        this.clientDevBuildNumber = 1

        this.debounceMilliseconds = 700
        this.progressMinDeltaSeconds = 5
        this.debugSnowui = false
        this.debugAudioContext = false
    }
}

export const config = new Config()


export function QuietReactWarning() {
    return null
}

export default QuietReactWarning