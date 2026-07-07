import { C, useAppContext, useAudioContext } from 'snowgroove'

export default function MusicSessionDetailsPage(props) {
    const {
        navPush
    } = C.useSnowContext(props)
    const { targetPlayer, changeTargetPlayer, routes } = useAppContext()
    const { clearMusicQueue, musicSession } = useAudioContext()



    if (!musicSession) {
        return <C.SnowLabel center>Loading music session...</C.SnowLabel>
    }

    let playerTarget = "Local Queue"
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

    let hasSongs = musicSession?.music_queue?.songs?.length

    return (
        <C.FillView>
            <C.SnowLabel center>{playerTarget}</C.SnowLabel>
            <C.SnowGrid>
                {hasSongs ?
                    <C.SnowTextButton
                        title="Clear Queue"
                        onPress={() => {
                            clearMusicQueue()
                        }}
                        short /> : null
                }
                <C.SnowTextButton short title="Repeat Mode" />
                {hasSongs ?
                    <C.SnowTextButton short title="Save as Playlist" onPress={navPush({
                        path: routes.playlistUpdate
                    })} /> : null}
                {clearTarget}
            </C.SnowGrid>
            {audioFiles}
        </C.FillView>
    )
}