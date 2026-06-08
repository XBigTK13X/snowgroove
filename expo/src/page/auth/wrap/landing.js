import { C, useAppContext, useAudioContext } from 'snowgroove'
import Snow from 'expo-snowui'
const snowuiPackageInfo = require('expo-snowui/package.json')

export default function LandingPage(props) {
    const { apiClient, routes, config } = useAppContext()
    const { SnowStyle, navPush } = C.useSnowContext(props)
    const { currentAudioFile, progressPercent, seekToSeconds, positionSeconds } = useAudioContext()
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
        <C.SnowTextButton title="Queue" onPress={navPush({ path: routes.continueWatching })} />,
        <C.SnowTextButton title="Search" onPress={navPush({ path: routes.search })} />,
        <C.SnowTextButton title="Playlists" onPress={navPush({ path: routes.playlistList })} />,
        <C.SnowTextButton title="Devices" onPress={navPush({ path: routes.deviceList })} />,
    ]

    if (shelves) {
        destinations = destinations.concat(shelves.map((shelf) => {
            return (
                <C.SnowTextButton
                    title={shelf.name}
                    onPress={navPush({ path: routes.crateDetails, params: { shelfId: shelf.id } })}
                />
            )
        }))
    }

    if (destinations) {
        let nowPlaying = "Nothing is currently playing."
        let playerControls = (
            <>
                <C.SnowText center>{nowPlaying}</C.SnowText>
                <C.SnowBreak />
            </>
        )
        if (currentAudioFile) {
            nowPlaying = `${currentAudioFile.title} - ${currentAudioFile.album} - ${currentAudioFile.artist}`
            let progressDisplay = `${C.util.secondsToTimestamp(positionSeconds)} / ${C.util.secondsToTimestamp(currentAudioFile.duration)}`
            playerControls = (
                <>
                    <C.SnowText center>{nowPlaying}</C.SnowText>
                    <C.SnowRangeSlider
                        onValueChange={(seekPercent) => {
                            seekToSeconds(seekPercent * currentAudioFile.duration)
                        }}
                        percent={progressPercent}
                    />
                    <C.SnowText center>{progressDisplay}</C.SnowText>
                    <C.SnowBreak />
                </>
            )
        }
        return (
            <>
                {playerControls}
                <C.SnowGrid
                    focusStart
                    focusKey="destinations"
                    items={destinations}
                    itemsPerRow={3} />
                <C.SnowText style={styles.footer} center>{`[built ${config.clientBuildDate}] [snowgroove v${config.clientVersion}] [snowui v${snowuiPackageInfo.version}]`}</C.SnowText>
            </>
        )
    }

    return (
        <C.SnowText center>
            Loading content from [{apiClient.webApiUrl}] v{config.clientVersion}
        </C.SnowText>
    )
}
