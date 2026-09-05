import React from 'react'
import { AppState } from 'react-native'
import { useAppContext } from '../app-context'
import { LocalAudioHandler } from './local-audio-handler'
import { RemoteAudioHandler } from './remote-audio-handler'
import { useMusicQueue } from './music-queue'
import { SnowAudioControls } from '../../modules/snow-audio-controls'

const AudioContext = React.createContext(null)

export function AudioContextProvider({ children }) {
    const { targetPlayer, apiClient, session } = useAppContext()
    const [musicSession, setMusicSession] = React.useState(null)
    const [isPlaying, setIsPlaying] = React.useState(false)
    const isPlayingRef = React.useRef(false)
    const [currentAudioFile, setCurrentAudioFile] = React.useState(null)
    const currentAudioFileRef = React.useRef(null)
    const [positionSeconds, setPositionSeconds] = React.useState(0)
    const [volume, setVolume] = React.useState(1.0)
    const volumeRef = React.useRef(1.0)

    const seekLockTimeoutRef = React.useRef(null)
    const isAdvancingTrackRef = React.useRef(false)
    const sessionRef = React.useRef(null)

    const isRemote = targetPlayer?.id !== undefined && targetPlayer?.id !== null

    const fetchLatestSessionRef = React.useRef(fetchLatestSession)
    fetchLatestSessionRef.current = fetchLatestSession

    React.useEffect(() => {
        const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active') {
                fetchLatestSessionRef.current?.()
            }
        })

        return () => {
            appStateSubscription.remove()
        }
    }, [])

    const queueManager = useMusicQueue({
        apiClient,
        session: musicSession,
        setSession: (nextSession) => {
            sessionRef.current = nextSession
            setMusicSession(nextSession)
        }
    })

    const setPlaying = (value) => {
        setIsPlaying(value)
        isPlayingRef.current = value
    }

    const changeMusicSession = (updater) => {
        const nextSession = typeof updater === 'function' ? updater(sessionRef.current) : updater
        sessionRef.current = nextSession
        setMusicSession(nextSession)
        return nextSession
    }

    async function fetchLatestSession() {
        if (!apiClient || !apiClient.isAuthenticated()) return null
        let response = null
        if (targetPlayer?.id) {
            response = await apiClient.getMusicSession(targetPlayer.id, targetPlayer.name)
        } else {
            response = await apiClient.getMusicSession()
        }
        if (response) {
            changeMusicSession(response)
            if (response.music_queue?.songs?.length) {
                let currentAudio = response.music_queue.songs[response.music_queue.current_song_index]
                setCurrentAudioFile(currentAudio)
                currentAudioFileRef.current = currentAudio
            }
            if (response.status?.volume !== undefined && response.status?.volume !== null) {
                const initialRemoteVolume = Math.max(0, Math.min(1, parseFloat(response.status.volume)))
                setVolume(initialRemoteVolume)
                volumeRef.current = initialRemoteVolume
                SnowAudioControls.syncRemoteVolume(initialRemoteVolume)
            }
        }
        return response
    }

    const handleLocalStatusUpdate = React.useCallback((status) => {
        if (!seekLockTimeoutRef.current && !isAdvancingTrackRef.current && status?.positionMillis !== undefined) {
            const nextSeconds = status.positionMillis / 1000
            setPositionSeconds((prevSeconds) => {
                if (Math.abs(prevSeconds - nextSeconds) >= 0.5) {
                    return nextSeconds
                }
                return prevSeconds
            })
        }
    }, [])

    const handleSongFinished = React.useCallback(async () => {
        if (isRemote) {
            if (isAdvancingTrackRef.current) return
            isAdvancingTrackRef.current = true

            try {
                setPositionSeconds(0)
                const nextSong = await queueManager.advanceQueueIndex(1, true)
                if (nextSong) {
                    currentAudioFileRef.current = nextSong
                    setCurrentAudioFile(nextSong)
                    await activeHandlerRef.current.play(nextSong)
                    setPlaying(true)
                } else {
                    setPlaying(false)
                }
            } finally {
                setTimeout(() => {
                    isAdvancingTrackRef.current = false
                }, 500)
            }
        } else {
            await fetchLatestSessionRef.current?.()
        }
    }, [isRemote, queueManager])

    const handleRemoteStateSync = React.useCallback((response) => {
        if (response.music_queue?.songs?.length) {
            let currentAudio = response.music_queue.songs[response.music_queue.current_song_index]
            setCurrentAudioFile(currentAudio)
            currentAudioFileRef.current = currentAudio

            if (sessionRef.current) {
                const updatedSession = {
                    ...sessionRef.current,
                    music_queue: response.music_queue
                }
                sessionRef.current = updatedSession
                setMusicSession(updatedSession)
            }
        }
        if (response.status?.position_seconds !== undefined && !seekLockTimeoutRef.current && !isAdvancingTrackRef.current) {
            setPositionSeconds(response.status.position_seconds)
        }
        if (response.status?.isPlaying !== undefined) {
            setPlaying(response.status.isPlaying)
        }
        if (response.status?.volume !== undefined && response.status?.volume !== null) {
            const normalizedVolume = Math.max(0, Math.min(1, parseFloat(response.status.volume)))
            setVolume(normalizedVolume)
            volumeRef.current = normalizedVolume
            SnowAudioControls.syncRemoteVolume(normalizedVolume)
        }
    }, [])

    const handleVolumeSync = React.useCallback((nextVolume) => {
        const normalized = Math.max(0, Math.min(1, nextVolume))
        volumeRef.current = normalized
        setVolume(normalized)
        SnowAudioControls.syncRemoteVolume(normalized)
    }, [])

    const localHandlerRef = React.useRef(
        new LocalAudioHandler({
            onStatusUpdate: handleLocalStatusUpdate,
            onFinished: handleSongFinished,
            initialVolume: volumeRef.current
        })
    )

    const remoteHandlerRef = React.useRef(
        new RemoteAudioHandler({
            apiClient,
            targetPlayer,
            getSession: () => sessionRef.current,
            onStateSync: handleRemoteStateSync,
            onVolumeChange: handleVolumeSync
        })
    )

    const activeHandler = isRemote ? remoteHandlerRef.current : localHandlerRef.current
    const activeHandlerRef = React.useRef(activeHandler)
    activeHandlerRef.current = activeHandler

    React.useEffect(() => {
        localHandlerRef.current.updateConfig({
            onStatusUpdate: handleLocalStatusUpdate,
            onFinished: handleSongFinished,
            volume: volumeRef.current
        })
    }, [handleLocalStatusUpdate, handleSongFinished])

    React.useEffect(() => {
        remoteHandlerRef.current.updateConfig({
            apiClient,
            targetPlayer,
            getSession: () => sessionRef.current,
            onStateSync: handleRemoteStateSync,
            onVolumeChange: handleVolumeSync
        })
    }, [apiClient, targetPlayer, handleRemoteStateSync, handleVolumeSync])

    const configureRemoteControlMode = React.useCallback((enabled) => {
        const resolvedSessionId = sessionRef.current?.id || musicSession?.id || ''
        SnowAudioControls.setRemoteControlMode(
            enabled,
            volumeRef.current,
            apiClient?.baseURL || '',
            apiClient?.authToken || '',
            resolvedSessionId
        )
    }, [apiClient, musicSession?.id])

    const prevTargetPlayerRef = React.useRef(targetPlayer)
    React.useEffect(() => {
        const wasRemote = prevTargetPlayerRef.current?.id !== undefined && prevTargetPlayerRef.current?.id !== null

        if (isRemote !== wasRemote) {
            if (isRemote) {
                localHandlerRef.current.deactivate()
                remoteHandlerRef.current.activate()
                configureRemoteControlMode(true)
            } else {
                remoteHandlerRef.current.deactivate()
                localHandlerRef.current.activate()
                configureRemoteControlMode(false)
            }
        }

        if (prevTargetPlayerRef.current?.id !== targetPlayer?.id) {
            setPlaying(false)
            setCurrentAudioFile(null)
            currentAudioFileRef.current = null
            setPositionSeconds(0)
            setMusicSession(null)
            sessionRef.current = null
        }

        prevTargetPlayerRef.current = targetPlayer
    }, [targetPlayer, isRemote, configureRemoteControlMode])

    React.useEffect(() => {
        if (isRemote && (sessionRef.current?.id || musicSession?.id)) {
            configureRemoteControlMode(true)
        }
    }, [isRemote, musicSession?.id, configureRemoteControlMode])

    React.useEffect(() => {
        if (!apiClient || !apiClient.isAuthenticated()) {
            if (!isRemote) {
                localHandlerRef.current.pause().then(() => setPlaying(false))
            }
            return
        }

        fetchLatestSession().then((response) => {
            if (response && !targetPlayer?.id) {
                if (response.music_queue?.songs?.length) {
                    let currentAudio = response.music_queue?.songs[response.music_queue.current_song_index]
                    setCurrentAudioFile(currentAudio)
                    currentAudioFileRef.current = currentAudio
                }
            }
        })
    }, [apiClient, targetPlayer, apiClient?.authToken, isRemote])

    React.useEffect(() => {
        return () => {
            if (seekLockTimeoutRef.current) {
                clearTimeout(seekLockTimeoutRef.current)
            }
            localHandlerRef.current.cleanup()
            remoteHandlerRef.current.cleanup()
        }
    }, [])

    const playAudioFile = React.useCallback(async (audioFile) => {
        if (isAdvancingTrackRef.current) return
        isAdvancingTrackRef.current = true

        try {
            await queueManager.setQueueIndexBySongId(audioFile.id)
            currentAudioFileRef.current = audioFile
            setCurrentAudioFile(audioFile)
            setPositionSeconds(0)

            await activeHandlerRef.current.play(audioFile)
            setPlaying(true)
        } finally {
            setTimeout(() => {
                isAdvancingTrackRef.current = false
            }, 500)
        }
    }, [queueManager])

    async function handleAddAudioFileToQueue(audioFile, playNext) {
        let shouldPlayImmediately = !isPlayingRef.current
        await queueManager.addAudioFileToQueue(audioFile, playNext)

        if (shouldPlayImmediately) {
            currentAudioFileRef.current = audioFile
            setCurrentAudioFile(audioFile)
            setPositionSeconds(0)
            await playAudioFile(audioFile)
        }
    }

    async function handleAddAudioFileListToQueue(audioFiles) {
        if (audioFiles?.length) {
            let shouldPlayImmediately = !isPlayingRef.current
            await queueManager.addAudioFileListToQueue(audioFiles)

            if (shouldPlayImmediately) {
                currentAudioFileRef.current = audioFiles[0]
                setCurrentAudioFile(audioFiles[0])
                setPositionSeconds(0)
                await playAudioFile(audioFiles[0])
            }
        }
    }

    async function handleRemoveAudioFileFromQueue(audioFile, skipPlay) {
        const result = await queueManager.removeAudioFileFromQueue(audioFile, skipPlay)
        if (!skipPlay && result) {
            if (result.hasSongs === true && result.nextSong) {
                await playAudioFile(result.nextSong)
            } else if (result.hasSongs === false) {
                await stopAudio()
            }
        }
    }

    async function handleClearMusicQueue() {
        await stopAudio()
        await queueManager.clearMusicQueue()
        currentAudioFileRef.current = null
        setCurrentAudioFile(null)
    }

    async function handleShuffleMusicQueue() {
        await stopAudio()
        const firstSong = await queueManager.shuffleMusicQueue()
        if (firstSong) {
            currentAudioFileRef.current = firstSong
            setCurrentAudioFile(firstSong)
            await playAudioFile(firstSong)
        }
    }

    async function stopAudio() {
        await activeHandler.stop()
        setPlaying(false)
    }

    async function togglePlayback() {
        if (isPlaying) {
            await activeHandler.pause()
            setPlaying(false)
        } else {
            if (currentAudioFile && !isRemote && !localHandlerRef.current.player) {
                await playAudioFile(currentAudioFile)
            } else {
                await activeHandler.resume()
                setPlaying(true)
            }
        }
    }

    async function seekToSeconds(seconds) {
        let maxDuration = currentAudioFileRef.current?.duration || 0
        let targetSeconds = Math.max(0, Math.min(seconds, maxDuration))
        setPositionSeconds(targetSeconds)

        if (seekLockTimeoutRef.current) {
            clearTimeout(seekLockTimeoutRef.current)
        }
        seekLockTimeoutRef.current = setTimeout(() => {
            seekLockTimeoutRef.current = null
        }, 1200)

        await activeHandler.seek(targetSeconds)
    }

    async function moveCurrentIndex(amount) {
        if (isAdvancingTrackRef.current) return
        isAdvancingTrackRef.current = true

        try {
            setPositionSeconds(0)
            const nextSong = await queueManager.advanceQueueIndex(amount, true)
            if (nextSong) {
                currentAudioFileRef.current = nextSong
                setCurrentAudioFile(nextSong)
                await activeHandler.play(nextSong)
                setPlaying(true)
            }
        } finally {
            setTimeout(() => {
                isAdvancingTrackRef.current = false
            }, 500)
        }
    }

    async function changeVolume(percent) {
        const volumeValue = Math.max(0, Math.min(1, percent))
        setVolume(volumeValue)
        volumeRef.current = volumeValue
        SnowAudioControls.syncRemoteVolume(volumeValue)
        await activeHandler.setVolume(volumeValue)
    }

    let progressPercent = currentAudioFile && currentAudioFile.duration > 0
        ? Math.min(1, Math.max(0, positionSeconds / currentAudioFile.duration))
        : 0

    React.useEffect(() => {
        const queueStaleSub = SnowAudioControls.addListener('queueStale', () => {
            fetchLatestSessionRef.current?.()
        })

        return () => {
            queueStaleSub.remove()
        }
    }, [])

    React.useEffect(() => {
        if (apiClient?.baseURL && apiClient?.authToken) {
            SnowAudioControls.configureApi(
                apiClient.baseURL,
                apiClient.authToken,
                sessionRef.current?.id || null
            )
        }
    }, [apiClient?.baseURL, apiClient?.authToken, sessionRef.current?.id])

    React.useEffect(() => {
        if (musicSession?.music_queue) {
            SnowAudioControls.requestQueueSync()
        }
    }, [musicSession])

    React.useEffect(() => {
        const trackSub = SnowAudioControls.addListener('trackChanged', (event) => {
            if (event?.songId && musicSession?.music_queue?.songs) {
                const songs = musicSession.music_queue.songs
                const nextIndex = songs.findIndex((song) => song.id === event.songId)
                if (nextIndex !== -1) {
                    const nextSong = songs[nextIndex]
                    currentAudioFileRef.current = nextSong
                    setCurrentAudioFile(nextSong)
                    setPositionSeconds(0)
                    setPlaying(true)
                }
            }
        })

        return () => {
            trackSub.remove()
        }
    }, [musicSession])

    React.useEffect(() => {
        const playSub = SnowAudioControls.addListener('play', () => togglePlayback())
        const pauseSub = SnowAudioControls.addListener('pause', () => togglePlayback())
        const nextSub = SnowAudioControls.addListener('next', () => moveCurrentIndex(1))
        const prevSub = SnowAudioControls.addListener('previous', () => moveCurrentIndex(-1))
        const seekSub = SnowAudioControls.addListener('seek', (event) => {
            if (event?.position !== undefined) {
                seekToSeconds(event.position)
            }
        })
        const volumeSub = SnowAudioControls.addListener('volumeAdjust', (event) => {
            if (event?.percent !== undefined) {
                const normalized = Math.max(0, Math.min(1, event.percent))
                setVolume(normalized)
                volumeRef.current = normalized
            }
        })

        return () => {
            playSub.remove()
            pauseSub.remove()
            nextSub.remove()
            prevSub.remove()
            seekSub.remove()
            volumeSub.remove()
        }
    }, [togglePlayback, moveCurrentIndex, seekToSeconds, changeVolume])

    React.useEffect(() => {
        if (isRemote && currentAudioFile) {
            SnowAudioControls.updateMetadata({
                title: currentAudioFile.title || 'Unknown Title',
                artist: currentAudioFile.artist || 'Unknown Artist',
                album: currentAudioFile.album || 'Unknown Album',
                artworkUrl: currentAudioFile.thumbnail_web_path || '',
                duration: currentAudioFile.duration || 0,
                isPlaying: isPlaying
            })
        }
    }, [isRemote, currentAudioFile, isPlaying])

    let contextValue = {
        addAudioFileToQueue: handleAddAudioFileToQueue,
        addAudioFileListToQueue: handleAddAudioFileListToQueue,
        addCrateToQueue: queueManager.addCrateToQueue,
        changeVolume,
        clearMusicQueue: handleClearMusicQueue,
        currentAudioFile,
        isPlaying,
        playAudioFile,
        positionSeconds,
        progressPercent,
        reorderMusicQueue: (list) => queueManager.reorderMusicQueue(list, currentAudioFileRef.current?.id),
        seekToSeconds,
        togglePlayback,
        musicSession,
        playNextSong: () => moveCurrentIndex(1),
        playPreviousSong: () => moveCurrentIndex(-1),
        removeAudioFileFromQueue: handleRemoveAudioFileFromQueue,
        removeCrateFromQueue: (crateId, kind) => queueManager.removeCrateFromQueue(crateId, kind, sessionRef.current),
        shuffleMusicQueue: handleShuffleMusicQueue,
        stopAudio,
        volume
    }

    return (
        <AudioContext.Provider value={contextValue}>
            {children}
        </AudioContext.Provider>
    )
}

export function useAudioContext() {
    const context = React.useContext(AudioContext)
    if (!context) {
        throw new Error('useAudio must be used within an AudioProvider')
    }
    return context
}