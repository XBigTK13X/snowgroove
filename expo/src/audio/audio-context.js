import React from 'react'
import { util } from 'expo-snowui'
import { useAppContext } from '../app-context'
import { SnowAudioControls } from '../../modules/snow-audio-controls'


const AudioContext = React.createContext(null)

export function useAudioContext() {
    const context = React.useContext(AudioContext)
    if (!context) {
        throw new Error('useAudioContext must be used within an AudioContextProvider')
    }
    return context
}

export function AudioContextProvider(props) {
    const { targetPlayer, config } = useAppContext()
    const [playback, setPlayback] = React.useState({
        isPlaying: false,
        positionSeconds: 0,
        volume: 1.0,
        currentAudioFile: null,
        musicSession: null
    })

    const duration = playback.currentAudioFile?.duration || 0
    const progressPercent = duration > 0
        ? Math.min(1, Math.max(0, playback.positionSeconds / duration))
        : 0

    const handlers = {
        playAudioFile: (audioFile) => {
            SnowAudioControls.playAudioFile(audioFile)
        },
        togglePlayback: () => {
            SnowAudioControls.togglePlayback()
        },
        stopAudio: () => {
            SnowAudioControls.stop()
        },
        seekToSeconds: (seconds) => {
            SnowAudioControls.seek(seconds)
        },
        changeVolume: (volumeLevel) => {
            SnowAudioControls.setVolume(volumeLevel)
        },
        playNextSong: () => {
            SnowAudioControls.moveCurrentIndex(1)
        },
        playPreviousSong: () => {
            SnowAudioControls.moveCurrentIndex(-1)
        },
        addAudioFileToQueue: (audioFile, playNext) => {
            SnowAudioControls.addAudioFileToQueue(audioFile, playNext)
        },
        addAudioFileListToQueue: (audioFiles) => {
            SnowAudioControls.addFileListToQueue(audioFiles)
        },
        removeAudioFileFromQueue: (audioFile, skipPlay) => {
            SnowAudioControls.removeAudioFileFromQueue(audioFile, skipPlay)
        },
        addCrateToQueue: (crateId) => {
            SnowAudioControls.addCrateToQueue(crateId)
        },
        removeCrateFromQueue: (crateId, kind) => {
            SnowAudioControls.removeCrateFromQueue(crateId, kind)
        },
        clearMusicQueue: () => {
            SnowAudioControls.clearQueue()
        },
        shuffleMusicQueue: () => {
            SnowAudioControls.shuffleQueue()
        },
        reorderMusicQueue: (list) => () => {
            SnowAudioControls.updateQueueOrder(list)
        }
    }

    React.useEffect(() => {
        SnowAudioControls.addListener('play', () => {
            if (config.debugAndroidAudio) util.prettyLog({ owner: 'audio-context', action: 'play' })
        }),
            SnowAudioControls.addListener('pause', () => {
                if (config.debugAndroidAudio) util.prettyLog({ owner: 'audio-context', action: 'pause' })
            }),
            SnowAudioControls.addListener('next', () => {
                if (config.debugAndroidAudio) util.prettyLog({ owner: 'audio-context', action: 'next' })
            }),
            SnowAudioControls.addListener('previous', () => {
                if (config.debugAndroidAudio) util.prettyLog({ owner: 'audio-context', action: 'previous' })
            }),
            SnowAudioControls.addListener('seek', (event) => {
                if (config.debugAndroidAudio) util.prettyLog({ owner: 'audio-context', action: 'seek', event })
            }),
            SnowAudioControls.addListener('volumeAdjust', (event) => {
                if (config.debugAndroidAudio) util.prettyLog({ owner: 'audio-context', action: 'volumeAdjust', event })
            }),
            SnowAudioControls.addListener('queueStale', () => {
                if (config.debugAndroidAudio) util.prettyLog({ owner: 'audio-context', action: 'queueStale' })
            }),
            SnowAudioControls.addListener('trackChanged', (event) => {
                if (config.debugAndroidAudio) util.prettyLog({ owner: 'audio-context', action: 'trackChanged', event })
            }),
            SnowAudioControls.addListener('log', (event) => {
                if (config.debugAndroidAudio) util.prettyLog({ owner: 'audio-context', action: 'log', event })
            }),
            SnowAudioControls.addListener('sessionChanged', (event) => {
                if (config.debugAndroidAudio) util.prettyLog({ owner: 'audio-context', action: 'sessionChanged', event })
                setPlaybackState((prev) => { return { ...prev, musicSession: event } })
            })
    }, [])

    React.useEffect(() => {
        SnowAudioControls.changeTargetPlayer(targetPlayer?.id ?? null, targetPlayer?.name ?? null)
    }, [targetPlayer?.id, targetPlayer?.name])



    let context = {
        ...playback,
        progressPercent,
        ...handlers
    }

    return (
        <AudioContext.Provider value={context}>
            {props.children}
        </AudioContext.Provider>
    )
}