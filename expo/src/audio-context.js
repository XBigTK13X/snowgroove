import React from 'react'
import { Audio } from 'expo-av'
import { useAppContext } from './app-context'

const AudioContext = React.createContext(null)

export function AudioContextProvider({ children }) {
    const { targetPlayerId, apiClient } = useAppContext()
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
        apiClient.getMusicSession(targetPlayerId).then(response => {
            setMusicSession(response)
        })
    }, [apiClient])

    React.useEffect(() => {
        return () => {
            if (sound) {
                sound.unloadAsync()
            }
        }
    }, [sound])

    async function updateMusicQueue(updater) {
        let updatedSession = structuredClone(musicSession)
        updatedSession.music_queue = updater(updatedSession.music_queue)
        apiClient.updateMusicSessionMusicQueue(musicSession.id, updatedSession.music_queue).then((response) => {
            setMusicSession(response)
        })
    }

    function handlePlaybackStatusUpdate(status) {
        if (status.isLoaded) {
            setPositionSeconds(status.positionMillis / 1000)
            if (status.didJustFinish) {
                setIsPlaying(false)
                setPositionSeconds(0)
                updateMusicQueue((queue) => {
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
        updateMusicQueue((queue) => {
            queue.songs.push(audioFile)
            return queue
        })
        if (!isPlaying) {
            playAudioFile(audioFile)
        }
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
        currentAudioFile,
        isPlaying,
        playAudioFile,
        playbackType,
        positionSeconds,
        progressPercent,
        seekToSeconds,
        togglePlayback,
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