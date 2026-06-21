import { C, useAppContext, useAudioContext } from 'snowgroove'

export default function MusicSessionDetailsPage(props) {
    const {
        currentRoute,
        navPush
    } = C.useSnowContext(props)


    const { clearMusicQueue, musicSession } = useAudioContext()
    const { targetPlayer, changeTargetPlayer } = useAppContext()


    if (!musicSession) {
        return <C.SnowLabel center>Loading music session...</C.SnowLabel>
    }

    let playerTarget = "Local"
    let clearTarget = null
    if (targetPlayer?.name) {
        playerTarget = `${targetPlayer.name}`
        clearTarget = <C.SnowTextButton short title="Stop Targeting" onPress={() => { changeTargetPlayer(null, null) }} />
    }

    let audioFiles = null
    if (musicSession?.music_queue?.songs?.length) {
        audioFiles = (
            <C.SnowSongList activeQueue audioFiles={musicSession.music_queue.songs} />
        )
    } else {
        audioFiles = <C.SnowLabel center>No songs found in the queue.</C.SnowLabel>
    }

    return (
        <C.FillView>
            <C.SnowLabel center>Active Queue: {playerTarget}</C.SnowLabel>
            <C.SnowGrid>
                {musicSession?.music_queue?.songs?.length ?
                    <C.SnowTextButton
                        title="Clear Queue"
                        onPress={() => {
                            clearMusicQueue()
                        }}
                        short /> : null
                }
                <C.SnowTextButton short title="Repeat Mode" />
                {clearTarget}
            </C.SnowGrid>
            {audioFiles}
        </C.FillView>
    )
}