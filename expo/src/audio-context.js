import React from 'react'
import { Audio } from 'expo-av'
import { useDebouncedCallback } from 'use-debounce'
import { useAppContext } from './app-context'

const AudioContext = React.createContext(null)

export function AudioContextProvider({ children }) {
    const { targetPlayer, apiClient } = useAppContext()
    const [musicSession, setMusicSession] = React.useState(null)
    const [sound, setSound] = React.useState(null)
    const [isPlaying, setIsPlaying] = React.useState(false)
    const [currentAudioFile, setCurrentAudioFile] = React.useState(null)
    const [positionSeconds, setPositionSeconds] = React.useState(0)

    const sessionRef = React.useRef(null)
    const soundRef = React.useRef(null)

    React.useEffect(() => {
        soundRef.current = sound
    }, [sound])

    const isRemote = targetPlayer?.id !== undefined && targetPlayer?.id !== null
    const playbackType = isRemote ? 'remote' : 'local'

    const localPlayer = {
        async play(audioFile) {
            if (soundRef.current) {
                await soundRef.current.unloadAsync()
            }
            const { sound: newSound } = await Audio.Sound.createAsync(
                { uri: audioFile.web_path },
                { shouldPlay: true },
                handlePlaybackStatusUpdate
            )
            newSound.setOnPlaybackStatusUpdate(handlePlaybackStatusUpdate)
            setSound(newSound)
            setIsPlaying(true)
        },
        async pause() {
            if (!soundRef.current) return
            await soundRef.current.pauseAsync()
            setIsPlaying(false)
        },
        async resume() {
            if (!soundRef.current) return
            await soundRef.current.playAsync()
            setIsPlaying(true)
        },
        async stop() {
            if (!soundRef.current) return
            await soundRef.current.pauseAsync()
            setIsPlaying(false)
        },
        async seek(seconds) {
            if (!soundRef.current) return
            await soundRef.current.setPositionAsync(seconds * 1000)
        }
    }

    const remotePlayer = {
        async play(audioFile) {
            if (soundRef.current) {
                await soundRef.current.unloadAsync()
                setSound(null)
            }
            if (apiClient) {
                await apiClient.musicSessionPlay(musicSession.id)
            }
            setIsPlaying(true)
        },
        async pause() {
            if (apiClient) {
                await apiClient.musicSessionPause(musicSession.id)
            }
            setIsPlaying(false)
        },
        async resume() {
            if (apiClient) {
                await apiClient.musicSessionPlay(musicSession.id)
            }
            setIsPlaying(true)
        },
        async stop() {
            if (apiClient) {
                await apiClient.musicSessionStop(musicSession.id)
            }
            setIsPlaying(false)
        },
        async seek(seconds) {
            if (apiClient) {
                await apiClient.musicSessionSeek(musicSession.id, seconds)
            }
        }
    }

    const currentPlayer = isRemote ? remotePlayer : localPlayer

    const prevTargetPlayerRef = React.useRef(targetPlayer)
    React.useEffect(() => {
        const wasLocal = prevTargetPlayerRef.current?.id === undefined || prevTargetPlayerRef.current?.id === null
        if (isRemote && wasLocal && soundRef.current) {
            soundRef.current.pauseAsync().then(() => {
                setIsPlaying(false)
            })
        }
        prevTargetPlayerRef.current = targetPlayer
    }, [targetPlayer, isRemote])

    const changeMusicSession = (updater) => {
        setMusicSession((current) => {
            const next = typeof updater === 'function' ? updater(current) : updater
            sessionRef.current = next
            return next
        })
    }

    React.useEffect(() => {
        if (!apiClient) {
            return
        }
        apiClient.getMusicSession(targetPlayer?.id).then(response => {
            changeMusicSession(response)
        })
    }, [apiClient, targetPlayer])

    React.useEffect(() => {
        return () => {
            if (soundRef.current) {
                soundRef.current.unloadAsync()
            }
        }
    }, [])

    const debouncedServerSync = useDebouncedCallback(async () => {
        const latestSession = sessionRef.current
        if (latestSession?.id && latestSession?.music_queue) {
            try {
                await apiClient.updateMusicSessionMusicQueue(latestSession.id, latestSession.music_queue)
            } catch (error) {
                console.error('Failed to sync music queue with server', error)
            }
        }
    }, 1000)

    async function updateMusicQueue(updater) {
        changeMusicSession((currentSession) => {
            let updatedSession = structuredClone(currentSession)
            updatedSession.music_queue = updater(updatedSession.music_queue)
            return updatedSession
        })

        debouncedServerSync()
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
                        const nextSong = queue?.songs?.at(queue.current_song_index)
                        setCurrentAudioFile(nextSong)
                        currentPlayer.play(nextSong)
                    }
                    return queue
                })
            }
        }
    }

    async function addAudioFileToQueue(audioFile) {
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
            setCurrentAudioFile(audioFile)
            setPositionSeconds(0)
            await currentPlayer.play(audioFile)
        }
    }

    async function addCrateToQueue(crateId) {
        let response = await apiClient.getCrateSongList(crateId)
        if (response.audio_files.length) {
            await updateMusicQueue((queue) => {
                if (!queue.hasOwnProperty('dedupe')) {
                    queue.dedupe = {}
                }
                for (let audioFile of response.audio_files) {
                    if (!queue.dedupe.hasOwnProperty(audioFile.fingerprint)) {
                        queue.dedupe[audioFile.fingerprint] = true
                        queue.songs.push(audioFile)
                    }
                }
                return queue
            })
            if (!isPlaying) {
                setCurrentAudioFile(response.audio_files[0])
                setPositionSeconds(0)
                await currentPlayer.play(response.audio_files[0])
            }
        }
    }

    async function reorderMusicQueue(updatedList) {
        await updateMusicQueue(queue => {
            queue.songs = updatedList
            if (currentAudioFile) {
                let ii = 0
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

    async function clearMusicQueue() {
        await updateMusicQueue(queue => {
            currentPlayer.stop()
            queue.songs = []
            queue.current_song_index = 0
            return queue
        })
    }


    async function stopAudio() {
        await currentPlayer.stop()
    }

    async function playAudioFile(audioFile) {
        await updateMusicQueue((queue) => {
            const targetIndex = queue.songs.findIndex((song) => song.id === audioFile.id)
            if (targetIndex !== -1) {
                queue.current_song_index = targetIndex
            }
            setCurrentAudioFile(audioFile)
            setPositionSeconds(0)
            currentPlayer.play(audioFile)
            return queue
        })

    }

    async function togglePlayback() {
        if (isPlaying) {
            await currentPlayer.pause()
        } else {
            await currentPlayer.resume()
        }
    }

    async function seekToSeconds(seconds) {
        let targetSeconds = Math.max(0, Math.min(seconds, currentAudioFile?.duration || 0))
        setPositionSeconds(targetSeconds)
        await currentPlayer.seek(targetSeconds)
    }

    let progressPercent = currentAudioFile && currentAudioFile.duration > 0
        ? positionSeconds / currentAudioFile.duration
        : 0

    let contextValue = {
        addAudioFileToQueue,
        addCrateToQueue,
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