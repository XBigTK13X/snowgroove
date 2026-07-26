import React from 'react'
import { useDebouncedCallback } from 'use-debounce'

export function useMusicQueue({ apiClient, session, setSession }) {
    const sessionRef = React.useRef(session)
    sessionRef.current = session

    const forceServerSync = React.useCallback(async (targetSession) => {
        const latestSession = targetSession || sessionRef.current
        if (latestSession?.id && latestSession?.music_queue) {
            await apiClient?.updateMusicSessionMusicQueue(latestSession.id, latestSession.music_queue)
        }
    }, [apiClient])

    const debouncedServerSync = useDebouncedCallback(async (targetSession) => {
        try {
            await forceServerSync(targetSession)
        } catch (error) {
            console.error('Failed to sync music queue with server', error)
        }
    }, 400)

    const updateMusicQueue = React.useCallback((updater, immediateSync = false) => {
        if (!sessionRef.current) return null

        let updatedSession = JSON.parse(JSON.stringify(sessionRef.current))
        if (updatedSession?.music_queue) {
            updatedSession.music_queue = updater(updatedSession.music_queue)
        }

        sessionRef.current = updatedSession
        setSession(updatedSession)

        if (immediateSync) {
            debouncedServerSync.cancel()
            forceServerSync(updatedSession)
        } else {
            debouncedServerSync(updatedSession)
        }

        return updatedSession
    }, [setSession, debouncedServerSync, forceServerSync])

    const addAudioFileToQueue = React.useCallback(async (audioFile, playNext) => {
        return updateMusicQueue((queue) => {
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
                    if (foundIndex !== -1) {
                        queue.songs.splice(foundIndex, 1)
                        queue.songs.splice(queue.current_song_index + 1, 0, audioFile)
                        if (queue.current_song_index > foundIndex) {
                            queue.current_song_index -= 1
                        }
                    }
                }
            }
            return queue
        }, true)
    }, [updateMusicQueue])

    const addAudioFileListToQueue = React.useCallback(async (audioFiles) => {
        if (!audioFiles?.length) return null
        return updateMusicQueue((queue) => {
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
    }, [updateMusicQueue])

    const addCrateToQueue = React.useCallback(async (crateId) => {
        if (!apiClient) return
        let response = await apiClient.getCrateSongList(crateId)
        await addAudioFileListToQueue(response?.audio_files)
    }, [apiClient, addAudioFileListToQueue])

    const removeAudioFileFromQueue = React.useCallback(async (audioFile, skipPlay) => {
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
            return { hasSongs, nextSong: songs?.[newIndex] }
        }
    }, [updateMusicQueue])

    const removeCrateFromQueue = React.useCallback(async (crateId, kind, currentSession) => {
        let targets = []
        for (let song of currentSession?.music_queue?.songs || []) {
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
    }, [removeAudioFileFromQueue])

    const reorderMusicQueue = React.useCallback(async (updatedList, currentAudioFileId) => {
        updateMusicQueue(queue => {
            queue.songs = updatedList
            if (currentAudioFileId) {
                for (let ii = 0; ii < queue.songs.length; ii++) {
                    if (queue.songs[ii].id === currentAudioFileId) {
                        queue.current_song_index = ii
                        break
                    }
                }
            }
            return queue
        })
    }, [updateMusicQueue])

    const clearMusicQueue = React.useCallback(async () => {
        updateMusicQueue(queue => {
            queue.dedupe = {}
            queue.songs = []
            queue.current_song_index = 0
            return queue
        }, true)
    }, [updateMusicQueue])

    const shuffleMusicQueue = React.useCallback(async () => {
        let firstSong = null
        updateMusicQueue(queue => {
            queue.current_song_index = 0
            for (let ii = queue.songs.length - 1; ii > 0; ii--) {
                const jj = Math.floor(Math.random() * (ii + 1))
                const temporary = queue.songs[ii]
                queue.songs[ii] = queue.songs[jj]
                queue.songs[jj] = temporary
            }
            firstSong = queue.songs[0]
            return queue
        }, true)
        return firstSong
    }, [updateMusicQueue])

    const advanceQueueIndex = React.useCallback((amount) => {
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
        return nextSong
    }, [updateMusicQueue])

    const setQueueIndexBySongId = React.useCallback((songId) => {
        updateMusicQueue((queue) => {
            const targetIndex = queue.songs.findIndex((song) => song.id === songId)
            if (targetIndex !== -1) {
                queue.current_song_index = targetIndex
            }
            return queue
        }, true)
    }, [updateMusicQueue])

    return {
        updateMusicQueue,
        addAudioFileToQueue,
        addAudioFileListToQueue,
        addCrateToQueue,
        removeAudioFileFromQueue,
        removeCrateFromQueue,
        reorderMusicQueue,
        clearMusicQueue,
        shuffleMusicQueue,
        advanceQueueIndex,
        setQueueIndexBySongId
    }
}