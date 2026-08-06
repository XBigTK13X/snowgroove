import { C, useAppContext, useAudioContext } from 'snowgroove'
import Snow from 'expo-snowui'
const snowuiPackageInfo = require('expo-snowui/package.json')

export default function LandingPage(props) {
    const {
        displayName,
        apiClient,
        config,
        targetPlayer
    } = useAppContext()
    const {
        SnowStyle,
        navPush,
        pushModal,
        popModal
    } = C.useSnowContext(props)
    const {
        changeVolume,
        currentAudioFile,
        isPlaying,
        playNextSong,
        playPreviousSong,
        positionSeconds,
        progressPercent,
        seekToSeconds,
        startRemotePolling,
        stopRemotePolling,
        togglePlayback,
        volume
    } = useAudioContext()
    const [shelves, setShelves] = C.React.useState(null)
    const volumeRef = C.React.useRef(null)

    C.React.useEffect(() => {
        apiClient.getShelfList().then((response) => {
            setShelves(response)
        })
    }, [])

    C.React.useEffect(() => {
        startRemotePolling()

        return () => {
            stopRemotePolling()
        }
    }, [])

    C.React.useEffect(() => {
        volumeRef.current = volume
    }, [volume])

    const styles = {
        footer: {
            width: '100%',
            textAlign: 'right',
            color: SnowStyle.color.active
        }
    }

    const showVolumeModal = () => {
        const initialVolume = volumeRef.current ?? volume ?? 1.0

        const VolumeSliderModal = () => {
            const [localVol, setLocalVol] = C.React.useState(initialVolume)
            const displayPercent = Math.round(Math.min(Math.max(0, localVol * 100), 100))

            return (
                <C.SnowGrid itemsPerRow={1}>
                    <C.SnowLabel center>Volume</C.SnowLabel>
                    <C.SnowRangeSlider
                        onValueChange={(volumePercent) => {
                            setLocalVol(volumePercent)
                            volumeRef.current = volumePercent
                            changeVolume(volumePercent)
                        }}
                        percent={localVol}
                    />
                    <C.SnowText center>{displayPercent}%</C.SnowText>
                    <C.SnowTextButton title="Close" onPress={popModal} />
                </C.SnowGrid>
            )
        }

        pushModal({
            render: () => <VolumeSliderModal />,
            props: {
                center: true,
                obscure: true,
                onRequestClose: popModal
            }
        })
    }

    if (shelves !== null) {
        let nowPlaying = `${displayName} has nothing currently playing.`
        let playerControls = (
            <C.View>
                <C.SnowText center>{nowPlaying}</C.SnowText>
                <C.SnowBreak />
            </C.View>
        )
        if (currentAudioFile) {
            let playerTarget = "Local Queue"
            if (targetPlayer?.name) {
                playerTarget = `${targetPlayer.name}`
            }
            let progressDisplay = `${displayName} [${playerTarget}] ${C.util.secondsToTimestamp(positionSeconds)} / ${C.util.secondsToTimestamp(currentAudioFile.duration)}`
            let NowText = SnowStyle.isPortrait ? C.SnowText : C.SnowLabel
            playerControls = (
                <C.View>
                    <NowText style={{ marginBottom: 0, marginTop: 0 }} marquee center>{currentAudioFile.title}</NowText>
                    <NowText style={{ marginBottom: 0, marginTop: 0 }} marquee center>{currentAudioFile.album}</NowText>
                    <NowText style={{ marginBottom: 0, marginTop: 0 }} marquee center>{currentAudioFile.artist}</NowText>
                    <C.SnowRangeSlider
                        yy={2}
                        onValueChange={(seekPercent) => {
                            seekToSeconds(seekPercent * currentAudioFile.duration)
                        }}
                        percent={progressPercent}
                    />
                    <C.SnowText center>{progressDisplay}</C.SnowText>
                    <C.SnowGrid yy={3} itemsPerRow={2}>
                        <C.SnowTextButton focusStart title={isPlaying ? "Pause" : "Play"} onPress={() => {
                            togglePlayback()
                        }} />
                        <C.SnowTextButton title="Volume" onPress={() => {
                            showVolumeModal()
                        }} />
                        <C.SnowTextButton title="Previous" onPress={() => {
                            playPreviousSong()
                        }} />
                        <C.SnowTextButton title="Next" onPress={() => {
                            playNextSong()
                        }} />
                    </C.SnowGrid>
                    <C.SnowGrid yy={4}>
                        <C.Image
                            style={{ width: SnowStyle.isPortrait ? 150 : 300, height: SnowStyle.isPortrait ? 150 : 300 }}
                            source={{ uri: currentAudioFile.thumbnail_web_path }}
                            contentFit="contain" />
                    </C.SnowGrid>
                </C.View>
            )
        }
        return (
            <C.View>
                {playerControls}
                <C.SnowText style={styles.footer} center>{`[built ${config.clientBuildDate}] [snowgroove v${config.clientVersion}] [snowui v${snowuiPackageInfo.version}]`}</C.SnowText>
            </C.View>
        )
    }

    return (
        <C.SnowText center>
            Loading content from [{apiClient.webApiUrl}] v{config.clientVersion}
        </C.SnowText>
    )
}
