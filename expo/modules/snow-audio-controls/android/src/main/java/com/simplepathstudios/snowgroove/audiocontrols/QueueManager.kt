package com.simplepathstudios.snowgroove.audiocontrols

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

data class QueueRemovalResult(
    val hasRemainingSongs: Boolean,
    val nextSong: AudioFile?,
)

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

    private fun updateQueue(transform: (MusicQueue) -> MusicQueue) {
        val session = musicSession ?: return
        val currentQueue = session.musicQueue ?: MusicQueue()
        val updatedQueue = transform(currentQueue)

        session.musicQueue = updatedQueue

        val targetSessionId = session.id ?: return

        scope.launch {
            if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
                SnowEvents.log(
                    "QueueManager->updateQueue",
                    "Syncing queue index: ${updatedQueue.currentSongIndex}, count: ${updatedQueue.songs.size} for sessionId: $targetSessionId",
                )
            }

            val isSuccess =
                ApiClient.updateMusicSessionQueue(
                    sessionId = targetSessionId,
                    queuePayload = updatedQueue,
                )
            if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
                SnowEvents.log("QueueManager->updateQueue", "Server sync success: $isSuccess")
            }
            SnowEvents.send("sessionChanged", session.toMap())
        }
    }

    fun addAudioFile(
        audioFile: AudioFile,
        playNow: Boolean = false,
        playNext: Boolean = false,
    ) {
        updateQueue { queue ->
            val updatedDedupe =
                if (audioFile.fingerprint !in queue.dedupe) {
                    queue.dedupe + (audioFile.fingerprint to true)
                } else {
                    queue.dedupe
                }

            val isNewSong = audioFile.fingerprint !in queue.dedupe
            val updatedSongs =
                if (isNewSong) {
                    queue.songs + audioFile
                } else {
                    queue.songs
                }.toMutableList()

            var updatedIndex = queue.currentSongIndex

            if (playNext && updatedSongs.size > 1) {
                val foundIndex =
                    updatedSongs.indexOf(audioFile).takeIf { it != -1 }
                        ?: updatedSongs.indexOfFirst { candidate -> candidate.fingerprint == audioFile.fingerprint }

                if (foundIndex != -1) {
                    updatedSongs.removeAt(foundIndex)
                    val targetIndex = (updatedIndex + 1).coerceAtMost(updatedSongs.size)
                    updatedSongs.add(targetIndex, audioFile)

                    if (updatedIndex > foundIndex) {
                        updatedIndex -= 1
                    }
                }
            }
            if (playNow) {
                updatedIndex = updatedSongs.indexOfFirst { candidate -> candidate.fingerprint == audioFile.fingerprint }
            }

            queue.copy(
                currentSongIndex = updatedIndex,
                songs = updatedSongs,
                dedupe = updatedDedupe,
            )
        }
    }

    fun addSongs(audioFiles: List<AudioFile>?) {
        if (audioFiles.isNullOrEmpty()) return

        updateQueue { queue ->
            val uniqueIncoming =
                audioFiles
                    .distinctBy { candidate -> candidate.fingerprint.ifEmpty { candidate.id } }
                    .filter { candidate -> candidate.fingerprint !in queue.dedupe }

            val updatedDedupe = queue.dedupe + uniqueIncoming.associate { candidate -> candidate.fingerprint to true }
            val updatedSongs = queue.songs + uniqueIncoming

            queue.copy(
                songs = updatedSongs,
                dedupe = updatedDedupe,
            )
        }
    }

    fun addCrate(
        crateId: String,
        onlyChildren: Boolean = false,
    ) {
        scope.launch {
            val response = ApiClient.getCrateSongList(crateId, onlyChildren)
            addSongs(response?.audioFiles)
        }
    }

    fun removeSong(audioFile: AudioFile): QueueRemovalResult {
        var hasRemaining = false
        var nextSong: AudioFile? = null

        updateQueue { queue ->
            val updatedDedupe = queue.dedupe - audioFile.fingerprint
            val foundIndex =
                queue.songs.indexOf(audioFile).takeIf { it != -1 }
                    ?: queue.songs.indexOfFirst { candidate -> candidate.id == audioFile.id }

            val updatedSongs = queue.songs.toMutableList()
            var updatedIndex = queue.currentSongIndex

            if (foundIndex != -1) {
                val wasLastItem = foundIndex == updatedSongs.lastIndex
                updatedSongs.removeAt(foundIndex)

                when {
                    foundIndex < updatedIndex -> {
                        updatedIndex -= 1
                    }

                    foundIndex == updatedIndex -> {
                        if (wasLastItem) {
                            updatedIndex -= 1
                        }
                        updatedIndex = updatedIndex.coerceAtLeast(0)
                    }
                }
            }

            hasRemaining = updatedSongs.isNotEmpty()
            nextSong = updatedSongs.getOrNull(updatedIndex)

            queue.copy(
                currentSongIndex = updatedIndex,
                songs = updatedSongs,
                dedupe = updatedDedupe,
            )
        }

        return QueueRemovalResult(
            hasRemainingSongs = hasRemaining,
            nextSong = nextSong,
        )
    }

    fun removeCrate(
        crateId: String,
        kind: String? = null,
    ) {
        updateQueue { queue ->
            val predicate: (AudioFile) -> Boolean =
                when (kind) {
                    "artist" -> { song -> song.artist == crateId }
                    "album" -> { song -> song.album == crateId }
                    else -> { song -> song.id == crateId }
                }

            val removedSongs = queue.songs.filter(predicate)
            if (removedSongs.isEmpty()) {
                return@updateQueue queue
            }

            val removedFingerprints = removedSongs.map { candidate -> candidate.fingerprint }.toSet()
            val updatedDedupe = queue.dedupe - removedFingerprints

            val currentSongBeforeRemoval = queue.songs.getOrNull(queue.currentSongIndex)
            val updatedSongs = queue.songs.filterNot(predicate)

            val updatedIndex =
                when {
                    updatedSongs.isEmpty() -> {
                        0
                    }

                    currentSongBeforeRemoval != null && updatedSongs.indexOf(currentSongBeforeRemoval) != -1 -> {
                        updatedSongs.indexOf(currentSongBeforeRemoval)
                    }

                    else -> {
                        queue.currentSongIndex.coerceIn(0, updatedSongs.lastIndex)
                    }
                }

            queue.copy(
                currentSongIndex = updatedIndex,
                songs = updatedSongs,
                dedupe = updatedDedupe,
            )
        }
    }

    fun reorderQueue(
        updatedList: List<AudioFile>,
        currentAudioFileId: String? = null,
    ) {
        updateQueue { queue ->
            val targetIndex =
                if (currentAudioFileId != null) {
                    val matchedIndex = updatedList.indexOfFirst { candidate -> candidate.id == currentAudioFileId }
                    if (matchedIndex != -1) matchedIndex else queue.currentSongIndex
                } else {
                    queue.currentSongIndex
                }

            queue.copy(
                currentSongIndex = targetIndex.coerceIn(0, (updatedList.size - 1).coerceAtLeast(0)),
                songs = updatedList,
            )
        }
    }

    fun clearQueue() {
        updateQueue { queue ->
            queue.copy(
                currentSongIndex = 0,
                songs = emptyList(),
                dedupe = emptyMap(),
            )
        }
    }

    fun shuffleQueue(): AudioFile? {
        var topSong: AudioFile? = null

        updateQueue { queue ->
            val shuffledSongs = queue.songs.shuffled()
            topSong = shuffledSongs.firstOrNull()

            queue.copy(
                currentSongIndex = 0,
                songs = shuffledSongs,
            )
        }

        return topSong
    }

    fun advanceSong(amount: Int): AudioFile? {
        val currentQueue = musicSession?.musicQueue ?: return null
        if (currentQueue.songs.isEmpty()) {
            if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
                SnowEvents.log("QueueManager->advanceSong", "Aborting: queue is empty")
            }
            return null
        }

        val previousIndex = currentQueue.currentSongIndex
        var nextSong: AudioFile? = null

        updateQueue { queue ->
            val queueSize = queue.songs.size
            val updatedIndex = (queue.currentSongIndex + amount).mod(queueSize)
            nextSong = queue.songs.getOrNull(updatedIndex)

            queue.copy(currentSongIndex = updatedIndex)
        }

        if (SnowConfig.DEBUG_ANDROID_AUDIO != null && nextSong != null) {
            SnowEvents.log(
                "QueueManager->advanceSong",
                "amount: $amount, index: $previousIndex -> ${musicSession?.musicQueue?.currentSongIndex}, title: ${nextSong?.title}, webPath: ${nextSong?.webPath}",
            )
        }

        return nextSong
    }

    fun setQueueIndexBySongId(songId: String) {
        updateQueue { queue ->
            val targetIndex = queue.songs.indexOfFirst { candidate -> candidate.id == songId }
            if (targetIndex != -1) {
                queue.copy(currentSongIndex = targetIndex)
            } else {
                queue
            }
        }
    }
}
