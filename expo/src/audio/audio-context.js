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
    const musicSessionRef = React.useRef(null)

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
            SnowAudioControls.addToQueue([audioFile])
            if (playNext) {
                // TODO Queue it up else play
            }
        },
        addAudioFileListToQueue: (audioFiles) => {
            SnowAudioControls.addToQueue(audioFiles)
        },
        removeAudioFileFromQueue: (audioFile) => {
            SnowAudioControls.removeFromQueue([audioFile])
        },
        addCrateToQueue: async (crateId, onlyChildren) => {
            let response = await apiClient.getCrateSongList(crateId, onlyChildren)
            SnowAudioControls.addToQueue(response?.audio_files)
        },
        removeCrateFromQueue: (crateId, kind) => {
            let targets = []
            for (let song of musicSessionRef?.current?.music_queue?.songs || []) {
                if (!kind) {
                    if (song.crate_id === crateId) {
                        targets.push(song)
                    }
                }
                else if (kind === 'artist') {
                    if (song.artist_crate_id === crateId) {
                        targets.push(song)
                    }
                }
                else if (kind === 'album') {
                    if (song.album_crate_id === crateId) {
                        targets.push(song)
                    }
                }
            }
            if (targets?.length) {
                SnowAudioControls.removeFromQueue(targets)
            }
        },
        clearQueue: () => {
            SnowAudioControls.clearQueue()
        },
        shuffleQueue: () => {
            SnowAudioControls.shuffleQueue()
        },
        moveQueueItem: ({ item, oldIndex, newIndex }) => {
            SnowAudioControls.moveQueueItem(oldIndex, newIndex)
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
                musicSessionRef.current = session
                setCurrentAudioFile(session.music_queue.songs[session.music_queue.current_song_index])
            }),
            SnowAudioControls.addListener('statusUpdate', (event) => {
                if (config.debugAndroidAudio === 'verbose') util.prettyLog({ owner: 'audio-context', action: 'statusUpdate', event })
                console.log({ event })
                setPositionSeconds(event.positionSeconds)
                setDurationSeconds(event.durationSeconds)
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
        positionSeconds,
        volume,
        currentAudioFile,
        musicSession,
        progressPercent,
        ...handlers
    }

    return (
        <AudioContext.Provider value={context}>
            {props.children}
        </AudioContext.Provider>
    )
}