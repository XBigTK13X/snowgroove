import { C, useAppContext, useAudioContext } from 'snowgroove'

export default function MusicSessionDetailsPage(props) {
    const {
        currentRoute,
        navPush
    } = C.useSnowContext(props)


    const { playAudioFile, reorderMusicQueue, clearMusicQueue, musicSession } = useAudioContext()
    const { apiClient, targetPlayer, changeTargetPlayer } = useAppContext()


    if (!musicSession) {
        return <C.SnowLabel center>Loading music session...</C.SnowLabel>
    }

    let playerTarget = "Local"
    let clearTarget = null
    if (targetPlayer?.name) {
        playerTarget = `${targetPlayer.name}`
        clearTarget = <C.SnowTextButton title="Stop Targeting" onPress={() => { changeTargetPlayer(null, null) }} />
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
                <C.SnowLabel center>Active Queue: {playerTarget}</C.SnowLabel>
                {musicSession?.music_queue?.songs?.length ?
                    <C.SnowTextButton
                        title="Clear Queue"
                        onPress={() => {
                            clearMusicQueue()
                        }} /> : null
                }
                {clearTarget}
            </C.SnowGrid>
            {audioFiles}
        </C.FillView>
    )
}