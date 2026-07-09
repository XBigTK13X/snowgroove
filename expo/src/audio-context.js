import React from 'react'
import { Audio } from 'expo-av'
import { useDebouncedCallback } from 'use-debounce'
import { useAppContext } from './app-context'

const AudioContext = React.createContext(null)

export function AudioContextProvider({ children }) {
    const { targetPlayer, apiClient, session } = useAppContext()
    const [musicSession, setMusicSession] = React.useState(null)
    const [sound, setSound] = React.useState(null)
    const [isPlaying, setIsPlaying] = React.useState(false)
    const [currentAudioFile, setCurrentAudioFile] = React.useState(null)
    const currentAudioFileRef = React.useRef(null)
    const [positionSeconds, setPositionSeconds] = React.useState(0)

    const sessionRef = React.useRef(null)
    const soundRef = React.useRef(null)
    const pollIntervalRef = React.useRef(null)

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
        },
        async setVolume(percent) {
            if (!soundRef.current) return
            const volumeValue = Math.max(0, Math.min(100, percent)) / 100
            await soundRef.current.setVolumeAsync(volumeValue)
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
        },
        async volume(percent) {
            if (apiClient) {
                await apiClient.musicSessionVolume(musicSession.id, percent)
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

        if (prevTargetPlayerRef.current?.id !== targetPlayer?.id) {
            setIsPlaying(false)
            setCurrentAudioFile(null)
            currentAudioFileRef.current = null
            setPositionSeconds(0)
            setMusicSession(null)
            stopRemotePolling()
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

    function startRemotePolling() {
        if (!apiClient || !isRemote || !targetPlayer?.id || !session || pollIntervalRef.current) {
            return
        }

        const pollRemotePlaybackProgress = () => {
            apiClient.getRemotePlayer(targetPlayer.id)
                .then((response) => {
                    if (response && response.status) {
                        if (response.status.position_seconds !== undefined) {
                            setPositionSeconds(response.status.position_seconds)
                        }
                        if (response.status.is_playing !== undefined) {
                            setIsPlaying(response.status.is_playing)
                        }
                    }
                })
        }

        pollRemotePlaybackProgress()
        pollIntervalRef.current = setInterval(pollRemotePlaybackProgress, 1000)
    }

    function stopRemotePolling() {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current)
            pollIntervalRef.current = null
        }
    }

    React.useEffect(() => {
        return () => {
            if (soundRef.current) {
                soundRef.current.unloadAsync()
            }
            stopRemotePolling()
        }
    }, [])

    async function forceServerSync() {
        const latestSession = sessionRef.current
        if (latestSession?.id && latestSession?.music_queue) {
            await apiClient.updateMusicSessionMusicQueue(latestSession.id, latestSession.music_queue)
        }
    }

    const debouncedServerSync = useDebouncedCallback(async () => {
        try {
            await forceServerSync()
        } catch (error) {
            console.error('Failed to sync music queue with server', error)
        }
    }, 1000)

    async function updateMusicQueue(updater, immediateSync = false) {
        changeMusicSession((currentSession) => {
            let updatedSession = structuredClone(currentSession)
            updatedSession.music_queue = updater(updatedSession.music_queue)
            return updatedSession
        })

        if (immediateSync) {
            debouncedServerSync.cancel()
            await forceServerSync()
        } else {
            debouncedServerSync()
        }
    }

    async function handlePlaybackStatusUpdate(status) {
        if (status.isLoaded) {
            setPositionSeconds(status.positionMillis / 1000)
            if (status.didJustFinish) {
                setIsPlaying(false)
                setPositionSeconds(0)

                let nextSong = null
                let shouldPlayNext = false

                await updateMusicQueue((queue) => {
                    queue.current_song_index += 1
                    if (queue.current_song_index > queue?.songs?.length - 1) {
                        queue.current_song_index = 0
                    } else {
                        nextSong = queue?.songs?.at(queue.current_song_index)
                        shouldPlayNext = true
                    }
                    return queue
                }, true)

                if (shouldPlayNext && nextSong) {
                    setCurrentAudioFile(nextSong)
                    currentAudioFileRef.current = nextSong
                    await currentPlayer.play(nextSong)
                }
            }
        }
    }

    async function addAudioFileToQueue(audioFile, playNext) {
        let shouldPlayImmediately = !isPlaying
        await updateMusicQueue((queue) => {
            if (!queue.hasOwnProperty('dedupe')) {
                queue.dedupe = {}
            }
            if (!queue.dedupe.hasOwnProperty(audioFile.fingerprint)) {
                queue.dedupe[audioFile.fingerprint] = true
                queue.songs.push(audioFile)
            }
            if (playNext) {
                if (queue.songs.length > 1) {
                    let foundIndex = queue.songs.findIndex(item => item.id === audioFile.id)
                    queue.songs.splice(foundIndex, 1)
                    queue.songs.splice(queue.current_song_index + 1, 0, audioFile)
                    if (queue.current_song_index > foundIndex) {
                        queue.current_song_index -= 1
                    }
                }
            }
            return queue
        }, shouldPlayImmediately)

        if (shouldPlayImmediately) {
            currentAudioFileRef.current = audioFile
            setCurrentAudioFile(audioFile)
            setPositionSeconds(0)
            await currentPlayer.play(audioFile)
        }
    }

    async function addAudioFileListToQueue(audioFiles) {
        if (audioFiles?.length) {
            let shouldPlayImmediately = !isPlaying
            await updateMusicQueue((queue) => {
                if (!queue.hasOwnProperty('dedupe')) {
                    queue.dedupe = {}
                }
                for (let audioFile of audioFiles) {
                    if (!queue.dedupe.hasOwnProperty(audioFile.fingerprint)) {
                        queue.dedupe[audioFile.fingerprint] = true
                        queue.songs.push(audioFile)
                    }
                }
                return queue
            }, shouldPlayImmediately)

            if (shouldPlayImmediately) {
                currentAudioFileRef.current = audioFiles[0]
                setCurrentAudioFile(audioFiles[0])
                setPositionSeconds(0)
                await currentPlayer.play(audioFiles[0])
            }
        }
    }

    async function addCrateToQueue(crateId) {
        let response = await apiClient.getCrateSongList(crateId)
        await addAudioFileListToQueue(response?.audio_files)
    }

    async function removeAudioFileFromQueue(audioFile, skipPlay) {
        let hasSongs = null
        let newIndex = null
        let songs = null
        await updateMusicQueue((queue) => {
            delete queue.dedupe[audioFile.fingerprint]
            let foundIndex = queue.songs.findIndex(item => item.id === audioFile.id)
            let lastItem = foundIndex === queue.songs.length - 1
            queue.songs.splice(foundIndex, 1)
            if (foundIndex < queue.current_song_index) {
                queue.current_song_index -= 1
            }
            else if (foundIndex === queue.current_song_index) {
                if (lastItem) {
                    queue.current_song_index -= 1
                }
                if (queue.current_song_index < 0) {
                    queue.current_song_index = 0
                }
                hasSongs = !!queue.songs.length
            }

            newIndex = queue.current_song_index
            songs = queue.songs

            return queue
        })
        if (!skipPlay) {
            if (hasSongs === true) {
                playAudioFile(songs[newIndex])
            }
            else if (hasSongs === false) {
                stopAudio()
            }
        }
    }

    async function removeCrateFromQueue(crateId, kind) {
        let targets = []
        for (let song of musicSession.music_queue?.songs) {
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
        for (let target of targets) {
            await removeAudioFileFromQueue(target, true)
        }
    }

    async function reorderMusicQueue(updatedList) {
        await updateMusicQueue(queue => {
            queue.songs = updatedList
            if (currentAudioFileRef.current) {
                for (let ii = 0; ii < queue.songs.length; ii++) {
                    if (queue.songs[ii].id === currentAudioFileRef.current?.id) {
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
            queue.dedupe = {}
            queue.songs = []
            queue.current_song_index = 0
            currentAudioFileRef.current = null
            setCurrentAudioFile(null)
            return queue
        }, true)
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
            return queue
        }, true)
        currentAudioFileRef.current = audioFile
        setCurrentAudioFile(audioFile)
        setPositionSeconds(0)
        await currentPlayer.play(audioFile)
    }

    async function togglePlayback() {
        if (isPlaying) {
            await currentPlayer.pause()
        } else {
            await currentPlayer.resume()
        }
    }

    async function seekToSeconds(seconds) {
        let targetSeconds = Math.floor(Math.max(0, Math.min(seconds, currentAudioFileRef.current?.duration || 0)))
        setPositionSeconds(targetSeconds)
        await currentPlayer.seek(targetSeconds)
    }

    async function moveCurrentIndex(amount) {
        let nextSong = null
        await updateMusicQueue((queue) => {
            queue.current_song_index += amount
            if (queue.current_song_index < 0) {
                queue.current_song_index = queue.songs.length - 1
            }
            else {
                if (queue.current_song_index > queue.songs.length - 1) {
                    queue.current_song_index = 0
                }
            }
            nextSong = queue.songs[queue.current_song_index]
            return queue
        }, true)

        if (nextSong) {
            currentAudioFileRef.current = nextSong
            setCurrentAudioFile(nextSong)
            setPositionSeconds(0)
            await currentPlayer.play(nextSong)
        }
    }

    async function playNextSong() {
        return await moveCurrentIndex(1)
    }

    async function playPreviousSong() {
        return await moveCurrentIndex(-1)
    }

    let progressPercent = currentAudioFile && currentAudioFile.duration > 0
        ? positionSeconds / currentAudioFile.duration
        : 0

    let contextValue = {
        addAudioFileToQueue,
        addAudioFileListToQueue,
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
        musicSession,
        playNextSong,
        playPreviousSong,
        removeAudioFileFromQueue,
        removeCrateFromQueue,
        startRemotePolling,
        stopRemotePolling,
        stopAudio
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