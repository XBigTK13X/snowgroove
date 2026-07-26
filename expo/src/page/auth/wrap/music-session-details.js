import React from 'react'
import { C, useAppContext, useAudioContext } from 'snowgroove'

export default function MusicSessionDetailsPage(props) {
    const { navPush } = C.useSnowContext(props)
    const { targetPlayer, changeTargetPlayer, routes } = useAppContext()
    const { clearMusicQueue, musicSession, shuffleMusicQueue } = useAudioContext()

    if (!musicSession) {
        return <C.SnowLabel center>Loading music session...</C.SnowLabel>
    }

    let playerTarget = "Local Queue"
    let clearTarget = null
    if (targetPlayer?.name) {
        playerTarget = `${targetPlayer.name}`
        clearTarget = (
            <C.SnowTextButton
                short
                title="Stop Targeting"
                onPress={() => { changeTargetPlayer(null, null) }}
            />
        )
    }

    let hasSongs = musicSession?.music_queue?.songs?.length
    let audioFiles = null
    if (hasSongs) {
        audioFiles = (
            <C.SnowSongList focusStart activeQueue audioFiles={musicSession.music_queue.songs} />
        )
    } else {
        audioFiles = (
            <C.SnowView>
                <C.SnowLabel center>No songs found in the queue.</C.SnowLabel>
                <C.SnowTarget />
            </C.SnowView>
        )
    }

    return (
        <C.SnowView>
            <C.SnowLabel center>{playerTarget}</C.SnowLabel>
            <C.SnowGrid focusStart={!hasSongs}>
                {hasSongs ? (
                    <C.SnowTextButton
                        title="Clear Queue"
                        onPress={() => {
                            clearMusicQueue()
                        }}
                        short
                    />
                ) : null}
                {hasSongs ? <C.SnowTextButton short title="Shuffle" onPress={shuffleMusicQueue} /> : null}
                <C.SnowTextButton short title="Repeat Mode" />
                {hasSongs ? (
                    <C.SnowTextButton
                        short
                        title="Save as Playlist"
                        onPress={navPush({
                            path: routes.playlistUpdate
                        })}
                    />
                ) : null}
                {clearTarget}
            </C.SnowGrid>
            {audioFiles}
        </C.SnowView>
    )
}