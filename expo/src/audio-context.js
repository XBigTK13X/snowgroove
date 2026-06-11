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
        apiClient.getMusicSession(targetPlayerId).then(response => {
            setMusicSession(response)
        })
    }, [])

    React.useEffect(() => {
        return () => {
            if (sound) {
                sound.unloadAsync()
            }
        }
    }, [sound])

    function handlePlaybackStatusUpdate(status) {
        if (status.isLoaded) {
            setPositionSeconds(status.positionMillis / 1000)
            if (status.didJustFinish) {
                setIsPlaying(false)
                setPositionSeconds(0)
            }
        }
    }

    async function addAudioFileToQueue(audioFile) {
        let updatedSession = structuredClone(musicSession)
        updatedSession.musicQueue.songs.push(audioFile)
        apiClient.updateMusicSessionMusicQueue(musicSession.id, updatedSession.musicQueue).then((response) => {
            setMusicSession(response)
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