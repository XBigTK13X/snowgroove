import React from 'react'
import { useAppContext } from '../app-context'
import { useMusicQueue } from './music-queue'
import { LocalPlayer } from './local-player'
import { RemotePlayer } from './remote-player'

export const AudioContext = React.createContext(null)

export function useAudioContextBase() {
    const { targetPlayer, apiClient } = useAppContext()
    const [playbackState, setPlaybackState] = React.useState({
        isPlaying: false,
        positionSeconds: 0,
        volume: 1.0,
        currentAudioFile: null,
        musicSession: null
    })

    const isAdvancingTrackRef = React.useRef(false)
    const sessionRef = React.useRef(null)
    sessionRef.current = playbackState.musicSession

    const moveCurrentIndexRef = React.useRef(null)

    const handlersRef = React.useRef(null)
    if (!handlersRef.current) {
        const onStateChange = (patch) => setPlaybackState((prev) => ({ ...prev, ...patch }))
        handlersRef.current = {
            local: new LocalPlayer({
                apiClient,
                onStateChange,
                onTrackFinished: async () => {
                    if (moveCurrentIndexRef.current) {
                        await moveCurrentIndexRef.current(1)
                    }
                }
            }),
            remote: new RemotePlayer({ apiClient, onStateChange })
        }
    }

    React.useEffect(() => {
        handlersRef.current.local.updateConfig({
            apiClient,
            onTrackFinished: async () => {
                if (moveCurrentIndexRef.current) {
                    await moveCurrentIndexRef.current(1)
                }
            }
        })
        handlersRef.current.remote.updateConfig({ apiClient, targetPlayer })

        if (apiClient?.isAuthenticated()) {
            const active = (targetPlayer?.id !== undefined && targetPlayer?.id !== null)
                ? handlersRef.current.remote
                : handlersRef.current.local
            active.refreshSession()
        }
    }, [apiClient, apiClient?.authToken, targetPlayer])

    const isRemote = targetPlayer?.id !== undefined && targetPlayer?.id !== null
    const handler = isRemote ? handlersRef.current.remote : handlersRef.current.local

    const queueManager = useMusicQueue({
        apiClient,
        session: playbackState.musicSession,
        setSession: (nextSession) => {
            const resolvedSession = typeof nextSession === 'function' ? nextSession(sessionRef.current) : nextSession
            sessionRef.current = resolvedSession
            setPlaybackState((prev) => ({ ...prev, musicSession: resolvedSession }))
            if (handlersRef.current.remote) {
                handlersRef.current.remote.currentSession = resolvedSession
            }
        }
    })

    React.useEffect(() => {
        handler.activate({ targetPlayer })
        return () => handler.deactivate()
    }, [handler, targetPlayer])

    React.useEffect(() => {
        return () => {
            handlersRef.current.local.cleanup()
            handlersRef.current.remote.cleanup()
        }
    }, [])

    const playAudioFile = React.useCallback(async (audioFile) => {
        if (isAdvancingTrackRef.current) return
        isAdvancingTrackRef.current = true

        try {
            await queueManager.setQueueIndexBySongId(audioFile.id)
            await handler.play(audioFile)
        } finally {
            setTimeout(() => {
                isAdvancingTrackRef.current = false
            }, 500)
        }
    }, [queueManager, handler])

    const moveCurrentIndex = React.useCallback(async (amount) => {
        if (isAdvancingTrackRef.current) return
        isAdvancingTrackRef.current = true

        try {
            const nextSong = await queueManager.advanceQueueIndex(amount, true)
            if (nextSong) {
                await handler.play(nextSong)
            } else {
                await handler.stop()
            }
        } finally {
            setTimeout(() => {
                isAdvancingTrackRef.current = false
            }, 500)
        }
    }, [queueManager, handler])

    moveCurrentIndexRef.current = moveCurrentIndex

    const togglePlayback = React.useCallback(async () => {
        if (playbackState.isPlaying) {
            await handler.pause()
        } else {
            await handler.resume()
        }
    }, [handler, playbackState.isPlaying])

    const duration = playbackState.currentAudioFile?.duration || 0
    const progressPercent = duration > 0
        ? Math.min(1, Math.max(0, playbackState.positionSeconds / duration))
        : 0

    const contextValue = {
        ...playbackState,
        progressPercent,
        playAudioFile,
        togglePlayback,
        stopAudio: () => handler.stop(),
        seekToSeconds: (seconds) => handler.seek(seconds),
        changeVolume: (volumeLevel) => handler.setVolume(volumeLevel),
        playNextSong: () => moveCurrentIndex(1),
        playPreviousSong: () => moveCurrentIndex(-1),
        addAudioFileToQueue: async (audioFile, playNext) => {
            const shouldPlayImmediately = !playbackState.isPlaying
            await queueManager.addAudioFileToQueue(audioFile, playNext)
            if (shouldPlayImmediately) await playAudioFile(audioFile)
        },
        addAudioFileListToQueue: async (audioFiles) => {
            if (!audioFiles?.length) return
            const shouldPlayImmediately = !playbackState.isPlaying
            await queueManager.addAudioFileListToQueue(audioFiles)
            if (shouldPlayImmediately) await playAudioFile(audioFiles[0])
        },
        removeAudioFileFromQueue: async (audioFile, skipPlay) => {
            const result = await queueManager.removeAudioFileFromQueue(audioFile, skipPlay)
            if (!skipPlay && result) {
                if (result.hasSongs === true && result.nextSong) {
                    await playAudioFile(result.nextSong)
                } else if (result.hasSongs === false) {
                    await handler.stop()
                }
            }
        },
        clearMusicQueue: async () => {
            await handler.stop()
            await queueManager.clearMusicQueue()
            setPlaybackState((prev) => ({ ...prev, currentAudioFile: null }))
        },
        shuffleMusicQueue: async () => {
            await handler.stop()
            const firstSong = await queueManager.shuffleMusicQueue()
            if (firstSong) await playAudioFile(firstSong)
        },
        addCrateToQueue: queueManager.addCrateToQueue,
        reorderMusicQueue: (list) => queueManager.reorderMusicQueue(list, playbackState.currentAudioFile?.id),
        removeCrateFromQueue: (crateId, kind) => queueManager.removeCrateFromQueue(crateId, kind, playbackState.musicSession)
    }

    return {
        apiClient,
        playbackState,
        setPlaybackState,
        sessionRef,
        handler,
        moveCurrentIndex,
        togglePlayback,
        contextValue
    }
}

export function useAudioContext() {
    const context = React.useContext(AudioContext)
    if (!context) {
        throw new Error('useAudioContext must be used within an AudioContextProvider')
    }
    return context
}