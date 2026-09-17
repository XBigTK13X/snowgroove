package com.simplepathstudios.snowgroove.audiocontrols

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

class QueueManager {
    private val scope = CoroutineScope(Dispatchers.Main + Job())

    var musicSession: MusicSession? = null
        private set

    val currentSong: AudioFile?
        get() =
            musicSession?.musicQueue?.let { queue ->
                queue.songs.getOrNull(queue.currentSongIndex)
            }

    fun loadSession(
        remotePlayerId: Int?,
        remotePlayerName: String?,
    ) {
        scope.launch {
            val session = ApiClient.getMusicSession(remotePlayerId, remotePlayerName)
            if (session == null) {
                if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
                    SnowEvents.log("QueueManager->loadSession", "Failed to retrieve session")
                }
                return@launch
            }
            musicSession = session
            SnowEvents.send("sessionChanged", session.toMap())
        }
    }

    private fun syncQueue() {
        val session = musicSession ?: return
        val currentQueue = session.musicQueue ?: return
        val targetSessionId = session.id ?: return

        scope.launch {
            if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
                SnowEvents.log(
                    "QueueManager->syncQueue",
                    "Syncing queue index: ${currentQueue.currentSongIndex}, count: ${currentQueue.songs.size} for sessionId: $targetSessionId",
                )
            }
            SnowEvents.send("sessionChanged", session.toMap())
            val isSuccess =
                ApiClient.updateMusicSession(
                    sessionId = targetSessionId,
                    queue = currentQueue,
                )
            if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
                SnowEvents.log("QueueManager->syncQueue", "Server sync success: $isSuccess")
            }
        }
    }

    private fun getOrCreateQueue(): MusicQueue? {
        val session = musicSession ?: return null
        if (session.musicQueue == null) {
            session.musicQueue = MusicQueue()
        }
        return session.musicQueue
    }

    fun addAudioFile(
        audioFile: AudioFile,
        playNow: Boolean = false,
        playNext: Boolean = false,
    ) {
        val queue = getOrCreateQueue() ?: return
        val isNewSong = audioFile.fingerprint !in queue.dedupe

        if (isNewSong) {
            queue.dedupe = queue.dedupe + (audioFile.fingerprint to true)
            queue.songs = queue.songs + audioFile
        }

        if (playNext && queue.songs.size > 1) {
            val mutableSongs = queue.songs.toMutableList()
            val foundIndex =
                mutableSongs.indexOf(audioFile).takeIf { it != -1 }
                    ?: mutableSongs.indexOfFirst { candidate -> candidate.fingerprint == audioFile.fingerprint }

            if (foundIndex != -1) {
                mutableSongs.removeAt(foundIndex)
                val targetIndex = (queue.currentSongIndex + 1).coerceAtMost(mutableSongs.size)
                mutableSongs.add(targetIndex, audioFile)

                if (queue.currentSongIndex > foundIndex) {
                    queue.currentSongIndex -= 1
                }
                queue.songs = mutableSongs
            }
        }

        if (playNow) {
            val foundIndex = queue.songs.indexOfFirst { candidate -> candidate.fingerprint == audioFile.fingerprint }
            if (foundIndex != -1) {
                queue.currentSongIndex = foundIndex
            }
        }

        syncQueue()
    }

    fun addAudioFiles(audioFiles: List<AudioFile>?) {
        if (audioFiles.isNullOrEmpty()) return
        val queue = getOrCreateQueue() ?: return

        val uniqueIncoming =
            audioFiles
                .distinctBy { candidate -> candidate.fingerprint.ifEmpty { candidate.id } }
                .filter { candidate -> candidate.fingerprint !in queue.dedupe }

        if (uniqueIncoming.isEmpty()) return

        queue.dedupe = queue.dedupe + uniqueIncoming.associate { candidate -> candidate.fingerprint to true }
        queue.songs = queue.songs + uniqueIncoming

        syncQueue()
    }

    fun removeAudioFiles(audioFiles: List<AudioFile>) {
        val queue = musicSession?.musicQueue ?: return

        if (audioFiles.isEmpty() || queue.songs.isEmpty()) {
            return
        }

        val targetIds = audioFiles.map { fileItem -> fileItem.id }.toSet()
        val targetFingerprints = audioFiles.mapNotNull { fileItem -> fileItem.fingerprint }.toSet()

        val oldIndex = queue.currentSongIndex
        val currentSong = queue.songs.getOrNull(oldIndex)

        var removedBeforeCurrent = 0
        var isCurrentSongRemoved = false

        for (songIndex in queue.songs.indices) {
            val candidateSong = queue.songs[songIndex]
            val isTarget = candidateSong in audioFiles || candidateSong.id in targetIds

            if (isTarget) {
                if (songIndex < oldIndex) {
                    removedBeforeCurrent += 1
                } else if (songIndex == oldIndex) {
                    isCurrentSongRemoved = true
                }
            }
        }

        val remainingSongs =
            queue.songs.filter { candidateSong ->
                candidateSong !in audioFiles && candidateSong.id !in targetIds
            }

        queue.songs = remainingSongs
        queue.dedupe = queue.dedupe - targetFingerprints

        if (queue.songs.isEmpty()) {
            queue.currentSongIndex = 0
        } else if (isCurrentSongRemoved) {
            val adjustedIndex = oldIndex - removedBeforeCurrent
            queue.currentSongIndex = adjustedIndex.coerceIn(0, queue.songs.lastIndex)
        } else {
            val adjustedIndex =
                queue.songs.indexOf(currentSong).takeIf { it != -1 }
                    ?: (oldIndex - removedBeforeCurrent)
            queue.currentSongIndex = adjustedIndex.coerceIn(0, queue.songs.lastIndex)
        }

        val hasRemaining = queue.songs.isNotEmpty()
        val nextSong = queue.songs.getOrNull(queue.currentSongIndex)

        syncQueue()
    }

    fun reorderQueue(
        updatedList: List<AudioFile>,
        currentAudioFileId: Int? = null,
    ) {
        val queue = getOrCreateQueue() ?: return

        val targetIndex =
            if (currentAudioFileId != null) {
                val matchedIndex = updatedList.indexOfFirst { candidate -> candidate.id == currentAudioFileId }
                if (matchedIndex != -1) matchedIndex else queue.currentSongIndex
            } else {
                queue.currentSongIndex
            }

        queue.songs = updatedList
        queue.currentSongIndex = targetIndex.coerceIn(0, (updatedList.size - 1).coerceAtLeast(0))

        syncQueue()
    }

    fun clearQueue() {
        val queue = musicSession?.musicQueue ?: return
        queue.currentSongIndex = 0
        queue.songs = emptyList()
        queue.dedupe = emptyMap()

        syncQueue()
    }

    fun shuffleQueue(): AudioFile? {
        val queue = musicSession?.musicQueue ?: return null
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("QueueManager->shuffleQueue", "Queue is not null")
        }
        if (queue.songs.isEmpty()) return null
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("QueueManager->shuffleQueue", "Queue is not empty")
        }

        queue.songs = queue.songs.shuffled()
        queue.currentSongIndex = 0

        syncQueue()

        return queue.songs.firstOrNull()
    }

    fun advanceSong(amount: Int): AudioFile? {
        val queue = musicSession?.musicQueue ?: return null
        if (queue.songs.isEmpty()) {
            if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
                SnowEvents.log("QueueManager->advanceSong", "Aborting: queue is empty")
            }
            return null
        }

        val previousIndex = queue.currentSongIndex
        val queueSize = queue.songs.size
        queue.currentSongIndex = (queue.currentSongIndex + amount).mod(queueSize)
        val nextSong = queue.songs.getOrNull(queue.currentSongIndex)

        syncQueue()

        if (SnowConfig.DEBUG_ANDROID_AUDIO != null && nextSong != null) {
            SnowEvents.log(
                "QueueManager->advanceSong",
                "amount: $amount, index: $previousIndex -> ${queue.currentSongIndex}, title: ${nextSong.title}, webPath: ${nextSong.webPath}",
            )
        }

        return nextSong
    }

    fun setQueueIndexBySongId(songId: Int) {
        val queue = musicSession?.musicQueue ?: return
        val targetIndex = queue.songs.indexOfFirst { candidate -> candidate.id == songId }
        if (targetIndex != -1) {
            queue.currentSongIndex = targetIndex
            syncQueue()
        }
    }

    fun move(
        oldIndex: Int,
        newIndex: Int,
    ) {
        val queue = getOrCreateQueue() ?: return
        if (queue.songs.isEmpty()) return
        if (oldIndex !in queue.songs.indices) return
        if (oldIndex == newIndex) return

        val boundedTarget = newIndex.coerceIn(0, queue.songs.lastIndex)
        val mutableSongs = queue.songs.toMutableList()
        val movedSong = mutableSongs.removeAt(oldIndex)

        val insertionIndex =
            if (oldIndex < boundedTarget) {
                boundedTarget - 1
            } else {
                boundedTarget
            }

        mutableSongs.add(insertionIndex, movedSong)

        val currentIndex = queue.currentSongIndex
        val updatedCurrentIndex =
            when {
                currentIndex == oldIndex -> insertionIndex
                oldIndex < currentIndex && insertionIndex >= currentIndex -> currentIndex - 1
                oldIndex > currentIndex && insertionIndex <= currentIndex -> currentIndex + 1
                else -> currentIndex
            }

        queue.songs = mutableSongs
        queue.currentSongIndex = updatedCurrentIndex.coerceIn(0, queue.songs.lastIndex)

        syncQueue()
    }
}
