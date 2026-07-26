import React from 'react'
import { useAppContext } from '../app-context'
import { LocalAudioHandler } from './local-audio-handler'
import { RemoteAudioHandler } from './remote-audio-handler'
import { useMusicQueue } from './music-queue'

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

    const isSeekingRef = React.useRef(false)
    const sessionRef = React.useRef(null)

    const isRemote = targetPlayer?.id !== undefined && targetPlayer?.id !== null
    const playbackType = isRemote ? 'remote' : 'local'

    const queueManager = useMusicQueue({
        apiClient,
        session: musicSession,
        setSession: (next) => {
            sessionRef.current = next
            setMusicSession(next)
        }
    })

    const setPlaying = (val) => {
        setIsPlaying(val)
        isPlayingRef.current = val
    }

    const changeMusicSession = (updater) => {
        const next = typeof updater === 'function' ? updater(sessionRef.current) : updater
        sessionRef.current = next
        setMusicSession(next)
        return next
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
        }
        return response
    }

    const handleLocalStatusUpdate = React.useCallback((status) => {
        if (!isSeekingRef.current) {
            setPositionSeconds(status.positionMillis / 1000)
        }
    }, [])

    const handleSongFinished = React.useCallback(async () => {
        setPlaying(false)
        setPositionSeconds(0)

        const nextSong = queueManager.advanceQueueIndex(1)
        if (nextSong) {
            currentAudioFileRef.current = nextSong
            setCurrentAudioFile(nextSong)
            await localHandlerRef.current.loadAndPlay(nextSong)
            setPlaying(true)
        }
    }, [queueManager])

    const handleRemoteStateSync = React.useCallback((response) => {
        if (response.music_queue?.songs?.length) {
            let currentAudio = response.music_queue.songs[response.music_queue.current_song_index]
            setCurrentAudioFile(currentAudio)
            currentAudioFileRef.current = currentAudio

            // Update local session state so queue index stays in sync with remote auto-advances
            if (sessionRef.current) {
                const updatedSession = {
                    ...sessionRef.current,
                    music_queue: response.music_queue
                }
                sessionRef.current = updatedSession
                setMusicSession(updatedSession)
            }
        }
        if (response.status?.position_seconds !== undefined && !isSeekingRef.current) {
            setPositionSeconds(response.status.position_seconds)
        }
        if (response.status?.is_playing !== undefined) {
            setPlaying(response.status.is_playing)
        }
        if (response.status?.volume !== undefined) {
            const normalizedVolume = response.status.volume / 100
            setVolume(normalizedVolume)
        }
    }, [])

    const localHandlerRef = React.useRef(
        new LocalAudioHandler({
            onStatusUpdate: handleLocalStatusUpdate,
            onFinished: handleSongFinished
        })
    )

    const remoteHandlerRef = React.useRef(
        new RemoteAudioHandler({
            apiClient,
            targetPlayer,
            onStateSync: handleRemoteStateSync
        })
    )

    React.useEffect(() => {
        remoteHandlerRef.current.updateConfig({ apiClient, targetPlayer })
    }, [apiClient, targetPlayer])

    const activeHandler = isRemote ? remoteHandlerRef.current : localHandlerRef.current

    const playAudioFile = React.useCallback(async (audioFile) => {
        await queueManager.setQueueIndexBySongId(audioFile.id)
        currentAudioFileRef.current = audioFile
        setCurrentAudioFile(audioFile)
        setPositionSeconds(0)

        if (isRemote) {
            await activeHandler.play(sessionRef.current?.id)
        } else {
            await activeHandler.loadAndPlay(audioFile)
        }
        setPlaying(true)
    }, [isRemote, queueManager, activeHandler])

    const prevTargetPlayerRef = React.useRef(targetPlayer)
    React.useEffect(() => {
        const wasLocal = prevTargetPlayerRef.current?.id === undefined || prevTargetPlayerRef.current?.id === null

        if (isRemote && wasLocal) {
            localHandlerRef.current.pause().then(() => setPlaying(false))
        }

        if (prevTargetPlayerRef.current?.id !== targetPlayer?.id) {
            setPlaying(false)
            setCurrentAudioFile(null)
            currentAudioFileRef.current = null
            setPositionSeconds(0)
            setMusicSession(null)
            sessionRef.current = null
            remoteHandlerRef.current.stopPolling()
        }

        prevTargetPlayerRef.current = targetPlayer
    }, [targetPlayer, isRemote])

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
            localHandlerRef.current.cleanup()
            remoteHandlerRef.current.cleanup()
        }
    }, [])

    React.useEffect(() => {
        if (isRemote && targetPlayer?.id) {
            remoteHandlerRef.current.startPolling()
        }
    }, [isRemote, targetPlayer?.id, musicSession?.id])

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
        await activeHandler.stop(sessionRef.current?.id)
        setPlaying(false)
    }

    async function togglePlayback() {
        if (isPlaying) {
            await activeHandler.pause(sessionRef.current?.id)
            setPlaying(false)
        } else {
            if (!isRemote && !localHandlerRef.current.sound && currentAudioFileRef.current) {
                await localHandlerRef.current.loadAndPlay(currentAudioFileRef.current)
            } else {
                await activeHandler.resume(sessionRef.current?.id)
            }
            setPlaying(true)
        }
    }

    async function seekToSeconds(seconds) {
        let targetSeconds = Math.floor(Math.max(0, Math.min(seconds, currentAudioFileRef.current?.duration || 0)))
        isSeekingRef.current = true
        setPositionSeconds(targetSeconds)
        try {
            await activeHandler.seek(targetSeconds, sessionRef.current?.id)
        } finally {
            isSeekingRef.current = false
        }
    }
    async function moveCurrentIndex(amount) {
        const nextSong = await queueManager.advanceQueueIndex(amount, true)
        if (nextSong) {
            currentAudioFileRef.current = nextSong
            setCurrentAudioFile(nextSong)
            setPositionSeconds(0)
            if (isRemote) {
                await activeHandler.play(sessionRef.current?.id)
            } else {
                await activeHandler.loadAndPlay(nextSong)
            }
            setPlaying(true)
        }
    }
    async function changeVolume(percent) {
        const volumeValue = Math.max(0, Math.min(1, percent))
        setVolume(volumeValue)
        await activeHandler.setVolume(volumeValue, sessionRef.current?.id)
    }

    let progressPercent = currentAudioFile && currentAudioFile.duration > 0
        ? positionSeconds / currentAudioFile.duration
        : 0

    let contextValue = {
        addAudioFileToQueue: handleAddAudioFileToQueue,
        addAudioFileListToQueue: handleAddAudioFileListToQueue,
        addCrateToQueue: queueManager.addCrateToQueue,
        changeVolume,
        clearMusicQueue: handleClearMusicQueue,
        currentAudioFile,
        isPlaying,
        playAudioFile,
        playbackType,
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
        startRemotePolling: () => remoteHandlerRef.current.startPolling(),
        stopRemotePolling: () => remoteHandlerRef.current.stopPolling(),
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