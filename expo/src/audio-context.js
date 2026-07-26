import React from 'react'
import { Audio } from 'expo-av'
import { useDebouncedCallback } from 'use-debounce'
import { useAppContext } from './app-context'

const AudioContext = React.createContext(null)

export function AudioContextProvider({ children }) {
    const { targetPlayer, apiClient, session, changeTargetPlayer } = useAppContext()
    const [musicSession, setMusicSession] = React.useState(null)
    const [sound, setSound] = React.useState(null)
    const [isPlaying, setIsPlaying] = React.useState(false)
    const isPlayingRef = React.useRef(false)
    const [currentAudioFile, setCurrentAudioFile] = React.useState(null)
    const currentAudioFileRef = React.useRef(null)
    const [positionSeconds, setPositionSeconds] = React.useState(0)
    const [volume, setVolume] = React.useState(1.0)
    const volumeRef = React.useRef(1.0)

    const isSeekingRef = React.useRef(false)

    const sessionRef = React.useRef(null)
    const soundRef = React.useRef(null)
    const pollIntervalRef = React.useRef(null)

    React.useEffect(() => {
        soundRef.current = sound
    }, [sound])

    const isRemote = targetPlayer?.id !== undefined && targetPlayer?.id !== null
    const playbackType = isRemote ? 'remote' : 'local'

    const setPlaying = (val) => {
        setIsPlaying(val)
        isPlayingRef.current = val
    }

    const handlePlaybackStatusUpdateRef = React.useRef(null)

    async function handlePlaybackStatusUpdate(status) {
        if (status.isLoaded) {
            if (!isSeekingRef.current) {
                setPositionSeconds(status.positionMillis / 1000)
            }
            if (status.didJustFinish) {
                setPlaying(false)
                setPositionSeconds(0)

                let nextSong = null

                updateMusicQueue((queue) => {
                    if (!queue?.songs?.length) return queue
                    queue.current_song_index += 1
                    if (queue.current_song_index >= queue.songs.length) {
                        queue.current_song_index = 0
                    }
                    nextSong = queue.songs[queue.current_song_index]
                    return queue
                }, true)

                if (nextSong) {
                    currentAudioFileRef.current = nextSong
                    setCurrentAudioFile(nextSong)
                    await currentPlayer.play(nextSong)
                }
            }
        }
    }

    React.useEffect(() => {
        handlePlaybackStatusUpdateRef.current = handlePlaybackStatusUpdate
    })

    const onPlaybackStatusUpdate = (status) => {
        if (handlePlaybackStatusUpdateRef.current) {
            handlePlaybackStatusUpdateRef.current(status)
        }
    }

    const localPlayer = {
        async play(audioFile) {
            const soundToUnload = soundRef.current
            setSound(null)
            soundRef.current = null

            if (soundToUnload) {
                try {
                    await soundToUnload.stopAsync()
                    await soundToUnload.unloadAsync()
                } catch (swallow) {
                }
            }

            const { sound: newSound } = await Audio.Sound.createAsync(
                { uri: audioFile.web_path },
                { shouldPlay: true, volume: volumeRef.current },
                onPlaybackStatusUpdate
            )
            newSound.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate)
            setSound(newSound)
            setPlaying(true)
        },
        async pause() {
            if (!soundRef.current) return
            await soundRef.current.pauseAsync()
            setPlaying(false)
        },
        async resume() {
            if (!soundRef.current) {
                if (currentAudioFileRef.current) {
                    await localPlayer.play(currentAudioFileRef.current)
                }
                return
            }
            await soundRef.current.playAsync()
            setPlaying(true)
        },
        async stop() {
            if (!soundRef.current) return
            await soundRef.current.pauseAsync()
            setPlaying(false)
        },
        async seek(seconds) {
            if (!soundRef.current) return
            await soundRef.current.setPositionAsync(seconds * 1000)
        },
        async setVolume(percent) {
            const volumeValue = Math.max(0, Math.min(1, percent))
            setVolume(volumeValue)
            volumeRef.current = volumeValue
            if (!soundRef.current) return
            await soundRef.current.setVolumeAsync(volumeValue)
        }
    }

    const remotePlayer = {
        async play(audioFile) {
            if (soundRef.current) {
                await soundRef.current.unloadAsync()
                setSound(null)
            }
            if (apiClient && musicSession) {
                await apiClient.musicSessionPlay(musicSession.id)
            }
            setPlaying(true)
        },
        async pause() {
            if (apiClient && musicSession) {
                await apiClient.musicSessionPause(musicSession.id)
            }
            setPlaying(false)
        },
        async resume() {
            if (apiClient && musicSession) {
                await apiClient.musicSessionPlay(musicSession.id)
            }
            setPlaying(true)
        },
        async stop() {
            if (apiClient && musicSession) {
                await apiClient.musicSessionStop(musicSession.id)
            }
            setPlaying(false)
        },
        async seek(seconds) {
            if (apiClient && musicSession) {
                await apiClient.musicSessionSeek(musicSession.id, seconds)
            }
        },
        async setVolume(percent) {
            const volumeValue = Math.max(0, Math.min(1, percent))
            setVolume(volumeValue)
            volumeRef.current = volumeValue
            if (apiClient && musicSession) {
                await apiClient.musicSessionVolume(musicSession.id, volumeValue * 100)
            }
        }
    }

    const currentPlayer = isRemote ? remotePlayer : localPlayer

    const prevTargetPlayerRef = React.useRef(targetPlayer)
    React.useEffect(() => {
        const wasLocal = prevTargetPlayerRef.current?.id === undefined || prevTargetPlayerRef.current?.id === null
        if (isRemote && wasLocal && soundRef.current) {
            soundRef.current.pauseAsync().then(() => {
                setPlaying(false)
            })
        }

        if (prevTargetPlayerRef.current?.id !== targetPlayer?.id) {
            setPlaying(false)
            setCurrentAudioFile(null)
            currentAudioFileRef.current = null
            setPositionSeconds(0)
            setMusicSession(null)
            stopRemotePolling()
        }

        prevTargetPlayerRef.current = targetPlayer
    }, [targetPlayer, isRemote])

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
        }
        return response
    }

    React.useEffect(() => {
        if (!apiClient || !apiClient.isAuthenticated()) {
            if (!isRemote) {
                localPlayer.pause()
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

    function startRemotePolling() {
        if (!apiClient || !isRemote || !targetPlayer?.id || !session || pollIntervalRef.current) {
            return
        }

        const pollRemotePlaybackProgress = () => {
            apiClient.getRemotePlayer(targetPlayer.id)
                .then((response) => {
                    if (response && response.status) {
                        if (response.music_queue?.songs?.length) {
                            let currentAudio = response.music_queue?.songs[response.music_queue.current_song_index]
                            setCurrentAudioFile(currentAudio)
                            currentAudioFileRef.current = currentAudio
                        }
                        if (response.status.position_seconds !== undefined && !isSeekingRef.current) {
                            setPositionSeconds(response.status.position_seconds)
                        }
                        if (response.status.is_playing !== undefined) {
                            setPlaying(response.status.is_playing)
                        }
                        if (response.status.volume !== undefined) {
                            const normalizedVolume = response.status.volume / 100
                            setVolume(normalizedVolume)
                            volumeRef.current = normalizedVolume
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

    async function forceServerSync(targetSession) {
        const latestSession = targetSession || sessionRef.current
        if (latestSession?.id && latestSession?.music_queue) {
            await apiClient.updateMusicSessionMusicQueue(latestSession.id, latestSession.music_queue)
        }
    }

    const debouncedServerSync = useDebouncedCallback(async (targetSession) => {
        try {
            await forceServerSync(targetSession)
        } catch (error) {
            console.error('Failed to sync music queue with server', error)
        }
    }, 400)

    function updateMusicQueue(updater, immediateSync = false) {
        if (!sessionRef.current) return null

        let updatedSession = JSON.parse(JSON.stringify(sessionRef.current))
        if (updatedSession?.music_queue) {
            updatedSession.music_queue = updater(updatedSession.music_queue)
        }

        sessionRef.current = updatedSession
        setMusicSession(updatedSession)

        if (immediateSync) {
            debouncedServerSync.cancel()
            forceServerSync(updatedSession)
        } else {
            debouncedServerSync(updatedSession)
        }

        return updatedSession
    }

    async function addAudioFileToQueue(audioFile, playNext) {
        let shouldPlayImmediately = !isPlayingRef.current
        updateMusicQueue((queue) => {
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
        }, true)

        if (shouldPlayImmediately) {
            currentAudioFileRef.current = audioFile
            setCurrentAudioFile(audioFile)
            setPositionSeconds(0)
            await currentPlayer.play(audioFile)
        }
    }

    async function addAudioFileListToQueue(audioFiles) {
        if (audioFiles?.length) {
            let shouldPlayImmediately = !isPlayingRef.current
            updateMusicQueue((queue) => {
                if (!queue.hasOwnProperty('dedupe')) {
                    queue.dedupe = {}
                }
                const newSongs = []
                for (let ii = 0; ii < audioFiles.length; ii++) {
                    const audioFile = audioFiles[ii]
                    if (!queue.dedupe.hasOwnProperty(audioFile.fingerprint)) {
                        queue.dedupe[audioFile.fingerprint] = true
                        newSongs.push(audioFile)
                    }
                }
                if (newSongs.length > 0) {
                    queue.songs.push(...newSongs)
                }
                return queue
            }, true)

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
        updateMusicQueue((queue) => {
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
        updateMusicQueue(queue => {
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
        updateMusicQueue(queue => {
            currentPlayer.stop()
            queue.dedupe = {}
            queue.songs = []
            queue.current_song_index = 0
            currentAudioFileRef.current = null
            setCurrentAudioFile(null)
            return queue
        }, true)
    }

    function shuffleArray(array) {
        for (let ii = array.length - 1; ii > 0; ii--) {
            const jj = Math.floor(Math.random() * (ii + 1))
            const temporary = array[ii]
            array[ii] = array[jj]
            array[jj] = temporary
        }
        return array
    }

    async function shuffleMusicQueue() {
        updateMusicQueue(queue => {
            currentPlayer.stop()
            queue.current_song_index = 0
            queue.songs = shuffleArray(queue.songs)
            currentAudioFileRef.current = queue.songs[0]
            setCurrentAudioFile(queue.songs[0])
            return queue
        }, true)
        playAudioFile(currentAudioFileRef.current)
    }

    async function stopAudio() {
        await currentPlayer.stop()
    }

    async function playAudioFile(audioFile) {
        updateMusicQueue((queue) => {
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
            if (!isRemote && !soundRef.current && currentAudioFileRef.current) {
                await localPlayer.play(currentAudioFileRef.current)
            } else {
                await currentPlayer.resume()
            }
        }
    }

    async function seekToSeconds(seconds) {
        let targetSeconds = Math.floor(Math.max(0, Math.min(seconds, currentAudioFileRef.current?.duration || 0)))
        isSeekingRef.current = true
        setPositionSeconds(targetSeconds)
        try {
            await currentPlayer.seek(targetSeconds)
        } finally {
            isSeekingRef.current = false
        }
    }

    async function moveCurrentIndex(amount) {
        let nextSong = null
        updateMusicQueue((queue) => {
            if (!queue?.songs?.length) return queue
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
        }, false)

        if (nextSong) {
            currentAudioFileRef.current = nextSong
            setCurrentAudioFile(nextSong)
            setPositionSeconds(0)
            if (!isRemote) {
                await currentPlayer.play(nextSong)
            }
        }
    }

    async function playNextSong() {
        return await moveCurrentIndex(1)
    }

    async function playPreviousSong() {
        return await moveCurrentIndex(-1)
    }

    async function changeVolume(percent) {
        return await currentPlayer.setVolume(percent)
    }

    let progressPercent = currentAudioFile && currentAudioFile.duration > 0
        ? positionSeconds / currentAudioFile.duration
        : 0

    let contextValue = {
        addAudioFileToQueue,
        addAudioFileListToQueue,
        addCrateToQueue,
        changeVolume,
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
        shuffleMusicQueue,
        startRemotePolling,
        stopRemotePolling,
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