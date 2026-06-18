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
            <C.SnowSongList audioFiles={musicSession.music_queue.songs} />
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
                <C.SnowTextButton title="Repeat Mode" />
                {clearTarget}
            </C.SnowGrid>
            {audioFiles}
        </C.FillView>
    )
}