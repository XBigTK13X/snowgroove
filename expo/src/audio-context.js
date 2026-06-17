import React from 'react'
import { Audio } from 'expo-av'
import { useAppContext } from './app-context'

const AudioContext = React.createContext(null)

export function AudioContextProvider({ children }) {
    const { targetPlayer, apiClient } = useAppContext()
    const [musicSession, setMusicSession] = React.useState(null)
    const [sound, setSound] = React.useState(null)
    const [isPlaying, setIsPlaying] = React.useState(false)
    const [playbackType, setPlaybackType] = React.useState('local')
    const [currentAudioFile, setCurrentAudioFile] = React.useState(null)
    const [positionSeconds, setPositionSeconds] = React.useState(0)

    React.useEffect(() => {
        if (!apiClient) {
            return
        }
        apiClient.getMusicSession(targetPlayer?.id).then(response => {
            setMusicSession(response)
        })
    }, [apiClient, targetPlayer])

    React.useEffect(() => {
        return () => {
            if (sound) {
                sound.unloadAsync()
            }
        }
    }, [sound])

    async function updateMusicQueue(updater) {
        let latestQueue
        setMusicSession((currentSession) => {
            let updatedSession = structuredClone(currentSession)
            updatedSession.music_queue = updater(updatedSession.music_queue)
            latestQueue = updatedSession.music_queue
            return updatedSession
        })

        if (musicSession?.id && latestQueue) {
            await apiClient.updateMusicSessionMusicQueue(musicSession.id, latestQueue)
        }
    }

    async function handlePlaybackStatusUpdate(status) {
        if (status.isLoaded) {
            setPositionSeconds(status.positionMillis / 1000)
            if (status.didJustFinish) {
                setIsPlaying(false)
                setPositionSeconds(0)
                await updateMusicQueue((queue) => {
                    queue.current_song_index += 1
                    if (queue.current_song_index > queue?.songs?.length - 1) {
                        queue.current_song_index = 0
                    } else {
                        playAudioFile(queue?.songs?.at(queue.current_song_index))
                    }
                    return queue
                })
            }
        }
    }

    async function addAudioFileToQueue(audioFile) {
        console.log({ audioFile })
        await updateMusicQueue((queue) => {
            if (!queue.hasOwnProperty('dedupe')) {
                queue.dedupe = {}
            }
            if (!queue.dedupe.hasOwnProperty(audioFile.fingerprint)) {
                queue.dedupe[audioFile.fingerprint] = true
                queue.songs.push(audioFile)
            }
            return queue
        })
        if (!isPlaying) {
            playAudioFile(audioFile)
        }
    }

    async function reorderMusicQueue(updatedList) {
        await updateMusicQueue(queue => {
            queue.songs = updatedList
            if (currentAudioFile) {
                let ii = 0;
                for (let ii = 0; ii < queue.songs.length; ii++) {
                    if (queue.songs[ii].id === currentAudioFile.id) {
                        queue.current_song_index = ii
                        break
                    }
                }
            }
            return queue
        })
    }

    async function stopAudio() {
        if (!sound) return
        await sound.pauseAsync()
        setIsPlaying(false)
    }

    async function clearMusicQueue() {
        await updateMusicQueue(queue => {
            stopAudio()
            queue.songs = []
            queue.current_song_index = 0
            return queue
        })
    }

    async function playAudioFile(audioFile, type = 'local') {
        setPlaybackType(type)
        setCurrentAudioFile(audioFile)
        setPositionSeconds(0)

        if (type === 'remote') {
            if (sound) {
                await sound.unloadAsync()
                setSound(null)
            }
            setIsPlaying(true)
            return
        }

        if (sound) {
            await sound.unloadAsync()
        }

        const { sound: newSound } = await Audio.Sound.createAsync(
            { uri: audioFile.web_path },
            { shouldPlay: true },
            handlePlaybackStatusUpdate
        )

        newSound.setOnPlaybackStatusUpdate(handlePlaybackStatusUpdate)
        setSound(newSound)
        setIsPlaying(true)
    }

    async function togglePlayback() {
        if (playbackType === 'remote') {
            setIsPlaying(!isPlaying)
            return
        }

        if (!sound) return

        if (isPlaying) {
            await sound.pauseAsync()
            setIsPlaying(false)
        } else {
            await sound.playAsync()
            setIsPlaying(true)
        }
    }

    async function seekToSeconds(seconds) {
        if (playbackType === 'remote' || !sound) return

        let targetSeconds = Math.max(0, Math.min(seconds, currentAudioFile?.duration || 0))

        setPositionSeconds(targetSeconds)
        await sound.setPositionAsync(targetSeconds * 1000)
    }

    let progressPercent = currentAudioFile && currentAudioFile.duration > 0
        ? positionSeconds / currentAudioFile.duration
        : 0

    let contextValue = {
        addAudioFileToQueue,
        clearMusicQueue,
        currentAudioFile,
        isPlaying,
        playAudioFile,
        playbackType,
        positionSeconds,
        progressPercent,
        reorderMusicQueue,
        seekToSeconds,
        togglePlayback,
        musicSession
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