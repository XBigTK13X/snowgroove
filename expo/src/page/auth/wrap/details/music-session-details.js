import { C, useAppContext, useAudioContext } from 'snowgroove'

export default function MusicSessionDetailsPage(props) {
    const {
        currentRoute,
        navPush
    } = C.useSnowContext(props)


    const { playAudioFile, reorderMusicQueue, clearMusicQueue } = useAudioContext()
    const { apiClient, routes, isAdmin } = useAppContext()
    const [musicSession, setMusicSession] = C.React.useState(null)

    C.React.useEffect(() => {
        if (!apiClient) {
            return
        }
        apiClient.getMusicSession().then(response => {
            setMusicSession(response)
        })
    }, [apiClient])



    if (!musicSession) {
        return <C.SnowLabel center>Loading music session...</C.SnowLabel>
    }

    let playerTarget = "Local Device"
    if (currentRoute?.routeParams?.remotePlayerName) {
        playerTarget = currentRoute.routeParams.remotePlayerName
    }

    let audioFiles = null
    if (musicSession?.music_queue?.songs?.length) {
        audioFiles = (
            <C.SnowDraggableColumn
                title="Songs"
                items={musicSession.music_queue.songs}
                renderItem={(item) => {
                    return (
                        <C.SnowGrid leftAlignRows>
                            <C.Image
                                style={{ width: 50, height: 50 }}
                                source={{ uri: item.thumbnail_web_path }}
                            />
                            <C.SnowText>{item.position} - {item.title}</C.SnowText>
                        </C.SnowGrid>
                    )
                }}
                onPress={(item) => {
                    playAudioFile(item)
                }}
                onReorder={(updatedList) => {
                    reorderMusicQueue(updatedList)
                }}
            />
        )
    } else {
        audioFiles = <C.SnowLabel center>No songs found in the queue.</C.SnowLabel>
    }

    return (
        <C.FillView>
            <C.SnowGrid itemsPerRow={1}>
                <C.SnowLabel center>Targeting: {playerTarget}</C.SnowLabel>
                {musicSession?.music_queue?.songs?.length ?
                    <C.SnowTextButton
                        title="Clear Queue"
                        onPress={() => {
                            clearMusicQueue()
                        }} /> : null
                }
            </C.SnowGrid>
            {audioFiles}
        </C.FillView>
    )
}