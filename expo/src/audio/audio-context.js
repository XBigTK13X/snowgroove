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
    const { targetPlayer, config, apiClient } = useAppContext()

    const [isPlaying, setIsPlaying] = React.useState(false)
    const [positionSeconds, setPositionSeconds] = React.useState(0)
    const [durationSeconds, setDurationSeconds] = React.useState(0)
    const [volume, setVolume] = React.useState(1.0)
    const [currentAudioFile, setCurrentAudioFile] = React.useState(null)
    const [musicSession, setMusicSession] = React.useState(null)

    const progressPercent = durationSeconds > 0
        ? Math.min(1, Math.max(0, positionSeconds / durationSeconds))
        : 0

    const handlers = {
        playAudioFile: (audioFile) => {
            SnowAudioControls.play(audioFile)
        },
        resumePlayback: () => {
            SnowAudioControls.resume()
        },
        pausePlayback: () => {
            SnowAudioControls.pause()
        },
        togglePlayback: () => {
            if (isPlaying) {
                SnowAudioControls.pause()
            } else {
                SnowAudioControls.resume()
            }
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
        const listeners = [
            SnowAudioControls.addListener('apiConfigured', () => {
                if (config.debugAndroidAudio != null) util.prettyLog({ owner: 'audio-context', action: 'apiConfigured' })
            }),
            SnowAudioControls.addListener('sessionChanged', (session) => {
                if (config.debugAndroidAudio === 'verbose') util.prettyLog({ owner: 'audio-context', action: 'sessionChanged', session })
                setMusicSession(session)
                setCurrentAudioFile(session.music_queue.songs[session.music_queue.current_song_index])
            }),
            SnowAudioControls.addListener('statusUpdate', (event) => {
                if (config.debugAndroidAudio != null) util.prettyLog({ owner: 'audio-context', action: 'statusUpdate', event })
                setPositionSeconds(event.positionMillis / 1000)
                setDurationSeconds(event.durationMillis / 1000)
                setIsPlaying(event.isPlaying)
            }),
            SnowAudioControls.addListener('play', () => {
                if (config.debugAndroidAudio != null) util.prettyLog({ owner: 'audio-context', action: 'play' })
            }),
            SnowAudioControls.addListener('pause', () => {
                if (config.debugAndroidAudio != null) util.prettyLog({ owner: 'audio-context', action: 'pause' })
            }),
            SnowAudioControls.addListener('next', () => {
                if (config.debugAndroidAudio != null) util.prettyLog({ owner: 'audio-context', action: 'next' })
            }),
            SnowAudioControls.addListener('previous', () => {
                if (config.debugAndroidAudio != null) util.prettyLog({ owner: 'audio-context', action: 'previous' })
            }),
            SnowAudioControls.addListener('seek', (event) => {
                if (config.debugAndroidAudio != null) util.prettyLog({ owner: 'audio-context', action: 'seek', event })
            }),
            SnowAudioControls.addListener('volumeAdjust', (event) => {
                if (config.debugAndroidAudio != null) util.prettyLog({ owner: 'audio-context', action: 'volumeAdjust', event })
            }),
            SnowAudioControls.addListener('trackChanged', (event) => {
                if (config.debugAndroidAudio != null) util.prettyLog({ owner: 'audio-context', action: 'trackChanged', event })
            }),
            SnowAudioControls.addListener('log', (event) => {
                if (config.debugAndroidAudio != null) util.prettyLog({ owner: 'audio-context', action: 'log', event })
            })
        ]
        return () => {
            for (let listener of listeners) {
                listener.remove()
            }
        }
    }, [])

    React.useEffect(() => {
        if (apiClient?.baseURL && apiClient?.authToken) {
            SnowAudioControls.configureApi(
                apiClient
            )
            SnowAudioControls.changeTargetPlayer(targetPlayer?.id ?? null, targetPlayer?.name ?? null)
        }
    }, [apiClient?.baseURL, apiClient?.authToken, targetPlayer?.id, targetPlayer?.name])

    let context = {
        isPlaying,
        setIsPlaying,
        positionSeconds,
        setPositionSeconds,
        volume,
        setVolume,
        currentAudioFile,
        setCurrentAudioFile,
        musicSession,
        setMusicSession,
        progressPercent,
        ...handlers
    }

    return (
        <AudioContext.Provider value={context}>
            {props.children}
        </AudioContext.Provider>
    )
}