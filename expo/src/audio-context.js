import { createContext, useContext, useState, useEffect } from 'react'
import { Audio } from 'expo-av'

const AudioContext = createContext(null)

export function AudioContextProvider({ children }) {
    const [sound, setSound] = useState(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [playbackType, setPlaybackType] = useState('local')
    const [currentTrack, setCurrentTrack] = useState(null)

    useEffect(() => {
        return () => {
            if (sound) {
                sound.unloadAsync()
            }
        }
    }, [sound])

    async function playTrack(url, type = 'local') {
        setPlaybackType(type)
        setCurrentTrack(url)

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
            { uri: url },
            { shouldPlay: true }
        )
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

    return (
        <AudioContext.Provider value={{ isPlaying, playbackType, currentTrack, playTrack, togglePlayback }}>
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