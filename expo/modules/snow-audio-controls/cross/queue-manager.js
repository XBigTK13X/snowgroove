export default class QueueManager {
    constructor({ apiClient, eventEmitter, config }) {
        this.apiClient = apiClient
        this.eventEmitter = eventEmitter
        this.config = config
        this.musicSession = null
    }

    get currentSong() {
        const queue = this.musicSession?.music_queue || this.musicSession?.musicQueue
        if (!queue || !queue.songs) return null
        const currentIndex = queue.current_song_index ?? queue.currentSongIndex ?? 0
        return queue.songs[currentIndex] || null
    }

    setSession(session) {
        this.musicSession = session
    }

    async syncQueue() {
        const session = this.musicSession
        if (!session) return
        const queue = session.music_queue || session.musicQueue
        const sessionId = session.id
        if (!queue || sessionId === null || sessionId === undefined) return

        if (this.config?.debugAudioContext) {
            this.eventEmitter?.emit('log', {
                nativeOwner: 'QueueManager->syncQueue',
                message: `Syncing queue index: ${queue.current_song_index ?? queue.currentSongIndex}, count: ${queue.songs.length}`
            })
        }
        this.eventEmitter?.emit('sessionChanged', session)
        return await this.apiClient.updateMusicSessionMusicQueue(sessionId, queue)
    }

    getOrCreateQueue() {
        if (!this.musicSession) return null
        if (!this.musicSession.music_queue && !this.musicSession.musicQueue) {
            this.musicSession.music_queue = {
                current_song_index: 0,
                songs: [],
                dedupe: {}
            }
        }
        return this.musicSession.music_queue || this.musicSession.musicQueue
    }

    async addAudioFile(audioFile, playNow = false) {
        const queue = this.getOrCreateQueue()
        if (!queue) return

        if (!queue.dedupe) queue.dedupe = {}
        if (!queue.songs) queue.songs = []

        const isNew = !(audioFile.fingerprint in queue.dedupe)
        if (isNew) {
            queue.dedupe[audioFile.fingerprint] = true
            queue.songs.push(audioFile)
        }

        if (playNow) {
            const foundIndex = queue.songs.findIndex((candidate) => candidate.fingerprint === audioFile.fingerprint)
            if (foundIndex !== -1) {
                queue.current_song_index = foundIndex
            }
        }

        return await this.syncQueue()
    }

    async addAudioFiles(audioFiles) {
        if (!audioFiles || audioFiles.length === 0) return
        const queue = this.getOrCreateQueue()
        if (!queue) return

        if (!queue.dedupe) queue.dedupe = {}
        if (!queue.songs) queue.songs = []

        const seenBatch = new Set()
        const uniqueItems = []

        for (let ii = 0; ii < audioFiles.length; ii += 1) {
            const candidate = audioFiles[ii]
            const key = candidate.fingerprint || String(candidate.id)
            if (!seenBatch.has(key) && !(candidate.fingerprint in queue.dedupe)) {
                seenBatch.add(key)
                uniqueItems.push(candidate)
            }
        }

        if (uniqueItems.length === 0) return

        for (let ii = 0; ii < uniqueItems.length; ii += 1) {
            const candidate = uniqueItems[ii]
            queue.dedupe[candidate.fingerprint] = true
            queue.songs.push(candidate)
        }

        return await this.syncQueue()
    }

    async removeAudioFiles(audioFiles) {
        const queue = this.musicSession?.music_queue || this.musicSession?.musicQueue
        if (!queue || !queue.songs || audioFiles.length === 0 || queue.songs.length === 0) return

        const targetIds = new Set(audioFiles.map((fileItem) => fileItem.id))
        const targetFingerprints = new Set(audioFiles.map((fileItem) => fileItem.fingerprint).filter(Boolean))

        const oldIndex = queue.current_song_index ?? queue.currentSongIndex ?? 0
        const activeSong = queue.songs[oldIndex]

        let removedBeforeCurrent = 0
        let isCurrentRemoved = false

        for (let songIndex = 0; songIndex < queue.songs.length; songIndex += 1) {
            const candidate = queue.songs[songIndex]
            const isTarget = audioFiles.includes(candidate) || targetIds.has(candidate.id)

            if (isTarget) {
                if (songIndex < oldIndex) {
                    removedBeforeCurrent += 1
                } else if (songIndex === oldIndex) {
                    isCurrentRemoved = true
                }
            }
        }

        queue.songs = queue.songs.filter((candidate) => !audioFiles.includes(candidate) && !targetIds.has(candidate.id))

        targetFingerprints.forEach((fingerprint) => {
            delete queue.dedupe[fingerprint]
        })

        if (queue.songs.length === 0) {
            queue.current_song_index = 0
        } else if (isCurrentRemoved) {
            const adjustedIndex = oldIndex - removedBeforeCurrent
            queue.current_song_index = Math.max(0, Math.min(adjustedIndex, queue.songs.length - 1))
        } else {
            const matchIndex = queue.songs.indexOf(activeSong)
            const adjustedIndex = matchIndex !== -1 ? matchIndex : (oldIndex - removedBeforeCurrent)
            queue.current_song_index = Math.max(0, Math.min(adjustedIndex, queue.songs.length - 1))
        }

        return await this.syncQueue()
    }

    async playNext(audioFile) {
        const queue = this.getOrCreateQueue()
        if (!queue || !queue.songs || queue.songs.length <= 1) return

        let matchIndex = queue.songs.indexOf(audioFile)
        if (matchIndex === -1) {
            matchIndex = queue.songs.findIndex((candidate) => candidate.fingerprint === audioFile.fingerprint)
        }
        if (matchIndex === -1) return

        const currentIndex = queue.current_song_index ?? queue.currentSongIndex ?? 0
        if (matchIndex === currentIndex || matchIndex === currentIndex + 1) return

        const targetSong = queue.songs.splice(matchIndex, 1)[0]
        const targetIndex = Math.min(matchIndex < currentIndex ? currentIndex : currentIndex + 1, queue.songs.length)
        queue.songs.splice(targetIndex, 0, targetSong)

        if (matchIndex < currentIndex) {
            queue.current_song_index = currentIndex - 1
        }

        return await this.syncQueue()
    }

    async reorderQueue(updatedList, currentAudioFileId = null) {
        const queue = this.getOrCreateQueue()
        if (!queue) return

        let targetIndex = queue.current_song_index ?? queue.currentSongIndex ?? 0
        if (currentAudioFileId !== null && currentAudioFileId !== undefined) {
            const matchedIndex = updatedList.findIndex((candidate) => candidate.id === currentAudioFileId)
            if (matchedIndex !== -1) {
                targetIndex = matchedIndex
            }
        }

        queue.songs = updatedList
        queue.current_song_index = Math.max(0, Math.min(targetIndex, Math.max(0, updatedList.length - 1)))
        return await this.syncQueue()
    }

    async clearQueue() {
        const queue = this.musicSession?.music_queue || this.musicSession?.musicQueue
        if (!queue) return

        queue.current_song_index = 0
        queue.songs = []
        queue.dedupe = {}

        return await this.syncQueue()
    }

    async shuffleQueue() {
        const queue = this.musicSession?.music_queue || this.musicSession?.musicQueue
        if (!queue || !queue.songs || queue.songs.length === 0) return null

        const mutableSongs = [...queue.songs]
        for (let ii = mutableSongs.length - 1; ii > 0; ii -= 1) {
            const jj = Math.floor(Math.random() * (ii + 1))
            const temp = mutableSongs[ii]
            mutableSongs[ii] = mutableSongs[jj]
            mutableSongs[jj] = temp
        }

        queue.songs = mutableSongs
        queue.current_song_index = 0

        await this.syncQueue()
        return queue.songs[0] || null
    }

    advanceSong(amount) {
        const queue = this.musicSession?.music_queue || this.musicSession?.musicQueue
        if (!queue || !queue.songs || queue.songs.length === 0) return null

        const queueSize = queue.songs.length
        const currentIndex = queue.current_song_index ?? queue.currentSongIndex ?? 0
        const nextIndex = ((currentIndex + amount) % queueSize + queueSize) % queueSize
        queue.current_song_index = nextIndex

        this.syncQueue()
        return queue.songs[nextIndex] || null
    }

    setCurrentIndex(index) {
        const queue = this.musicSession?.music_queue || this.musicSession?.musicQueue
        if (queue) {
            queue.current_song_index = index
            this.syncQueue()
        }
    }

    async move(oldIndex, newIndex) {
        const queue = this.getOrCreateQueue()
        if (!queue || !queue.songs || queue.songs.length === 0) return
        if (oldIndex < 0 || oldIndex >= queue.songs.length) return
        if (oldIndex === newIndex) return

        const boundedTarget = Math.max(0, Math.min(newIndex, queue.songs.length - 1))
        const movedSong = queue.songs.splice(oldIndex, 1)[0]
        const insertionIndex = oldIndex < boundedTarget ? boundedTarget - 1 : boundedTarget
        queue.songs.splice(insertionIndex, 0, movedSong)

        const currentIndex = queue.current_song_index ?? queue.currentSongIndex ?? 0
        let updatedCurrentIndex = currentIndex

        if (currentIndex === oldIndex) {
            updatedCurrentIndex = insertionIndex
        } else if (oldIndex < currentIndex && insertionIndex >= currentIndex) {
            updatedCurrentIndex = currentIndex - 1
        } else if (oldIndex > currentIndex && insertionIndex <= currentIndex) {
            updatedCurrentIndex = currentIndex + 1
        }

        queue.current_song_index = Math.max(0, Math.min(updatedCurrentIndex, queue.songs.length - 1))
        return await this.syncQueue()
    }
}