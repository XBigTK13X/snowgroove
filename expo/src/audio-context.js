import { createContext, useContext, useState, useEffect } from 'react'
import { Audio } from 'expo-av'

const AudioContext = createContext(null)

export function AudioContextProvider({ children }) {
    const [sound, setSound] = useState(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [playbackType, setPlaybackType] = useState('local')
    const [currentAudioFile, setCurrentAudioFile] = useState(null)
    const [positionSeconds, setPositionSeconds] = useState(0)

    useEffect(() => {
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
        isPlaying,
        playbackType,
        currentAudioFile,
        positionSeconds,
        progressPercent,
        playAudioFile,
        togglePlayback,
        seekToSeconds
    }

    return (
        <AudioContext.Provider value={contextValue}>
            {children}
        </AudioContext.Provider>
    )
}

export function useAudioContext() {
    const context = useContext(AudioContext)
    if (!context) {
        throw new Error('useAudio must be used within an AudioProvider')
    }
    return context
}