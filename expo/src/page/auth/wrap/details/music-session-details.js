import { C, useAppContext, useAudioContext } from 'snowgroove'

export default function MusicSessionDetailsPage(props) {
    const {
        currentRoute,
        navPush
    } = C.useSnowContext(props)


    const { playAudioFile } = useAudioContext()
    const { apiClient, routes, isAdmin } = useAppContext()
    const [musicSession, setMusicSession] = C.React.useState(null)

    C.React.useEffect(() => {
        apiClient.getMusicSession().then(response => {
            setMusicSession(response)
        })
    }, [])



    if (!musicSession) {
        return <C.SnowLabel center>Loading music session...</C.SnowLabel>
    }

    let playerTarget = "Local Device"
    if (currentRoute?.routeParams?.remotePlayerName) {
        playerTarget = currentRoute.routeParams.remotePlayerName
    }

    let audioFiles = null
    if (musicSession?.musicQueue?.songs?.length) {
        audioFiles = (
            <C.SnowDraggableColumn
                title="Songs"
                items={musicSession.musicQueue.songs}
                renderItem={(item) => {
                    return (
                        <C.SnowView>
                            <C.SnowText>{item.position} - {item.title}</C.SnowText>
                        </C.SnowView>
                    )
                }}
                onPress={(item) => {
                    playAudioFile(item)
                }}
            />
        )
    } else {
        audioFiles = <C.SnowLabel center>No songs found in the queue.</C.SnowLabel>
    }

    return (
        <C.FillView>
            <C.SnowView>
                <C.SnowLabel center>Targeting: {playerTarget}</C.SnowLabel>
                {audioFiles}
            </C.SnowView>
        </C.FillView>
    )
}