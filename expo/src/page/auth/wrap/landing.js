import { C, useAppContext, useAudioContext } from 'snowgroove'
import Snow from 'expo-snowui'
const snowuiPackageInfo = require('expo-snowui/package.json')

export default function LandingPage(props) {
    const { apiClient, routes, config, targetPlayer } = useAppContext()
    const { SnowStyle, navPush } = C.useSnowContext(props)
    const {
        currentAudioFile,
        progressPercent,
        seekToSeconds,
        positionSeconds,
        isPlaying,
        togglePlayback,
        playPreviousSong,
        playNextSong,
        startRemotePolling,
        stopRemotePolling
    } = useAudioContext()
    const [shelves, setShelves] = C.React.useState(null)

    C.React.useEffect(() => {
        if (config.debugVideoUrl) {
            const parts = config.debugVideoUrl.split('?')
            const payload = {
                path: parts[0],
                params: Snow.queryToObject(parts[1]),
                func: false
            }
            navPush(payload)
        }
    }, [config])

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

    if (config.debugVideoUrl) {
        return null
    }

    const styles = {
        footer: {
            width: '100%',
            textAlign: 'right',
            color: SnowStyle.color.active
        }
    }

    let destinations = [
        <C.SnowTextButton title="Search" onPress={navPush({ path: routes.search })} />,
        <C.SnowTextButton title="Playlists" onPress={navPush({ path: routes.playlistList })} />,
        <C.SnowTextButton title="Devices" onPress={navPush({ path: routes.deviceList })} />,
    ]

    if (shelves) {
        destinations = (shelves.map((shelf) => {
            return (
                <C.SnowTextButton
                    title={"Browse"}
                    onPress={navPush({ path: routes.crateDetails, params: { shelfId: shelf.id } })}
                />
            )
        })).concat(destinations)
    }
    if (shelves !== null) {
        let nowPlaying = "Nothing is currently playing."
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
            nowPlaying = `${currentAudioFile.title} - ${currentAudioFile.album} - ${currentAudioFile.artist}`
            let progressDisplay = `[${playerTarget}] ${C.util.secondsToTimestamp(positionSeconds)} / ${C.util.secondsToTimestamp(currentAudioFile.duration)}`
            playerControls = (
                <C.View>
                    <C.SnowLabel marquee center>{nowPlaying}</C.SnowLabel>
                    <C.SnowGrid yy={2}>
                        <C.Image
                            style={{ width: 300, height: 300 }}
                            source={{ uri: currentAudioFile.thumbnail_web_path }}
                            contentFit="contain" />
                    </C.SnowGrid>
                    <C.SnowRangeSlider
                        onValueChange={(seekPercent) => {
                            seekToSeconds(seekPercent * currentAudioFile.duration)
                        }}
                        percent={progressPercent}
                    />
                    <C.SnowText center>{progressDisplay}</C.SnowText>
                    <C.SnowGrid yy={3}>
                        <C.SnowTextButton short title="Previous" onPress={() => {
                            playPreviousSong()
                        }} />
                        <C.SnowTextButton focusStart short title={isPlaying ? "Pause" : "Play"} onPress={() => {
                            togglePlayback()
                        }} />
                        <C.SnowTextButton short title="Next" onPress={() => {
                            playNextSong()
                        }} />
                        <C.SnowTextButton short title="Volume" onPress={() => {
                            //TODO Show a slider modal
                            changeVolume(0.3)
                        }} />
                    </C.SnowGrid>
                    <C.SnowBreak />
                </C.View>
            )
        }
        return (
            <C.View>
                {playerControls}
                <C.SnowGrid
                    yy={4}
                    focusStart={!currentAudioFile}
                    focusKey="destinations"
                    itemsPerRow={2}>
                    {destinations}
                </C.SnowGrid>
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
