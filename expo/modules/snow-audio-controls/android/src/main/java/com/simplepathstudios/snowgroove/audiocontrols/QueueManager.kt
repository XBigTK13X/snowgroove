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

            val isSuccess =
                ApiClient.updateMusicSessionQueue(
                    sessionId = targetSessionId,
                    queuePayload = currentQueue,
                )
            if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
                SnowEvents.log("QueueManager->syncQueue", "Server sync success: $isSuccess")
            }
            SnowEvents.send("sessionChanged", session.toMap())
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

    fun addSongs(audioFiles: List<AudioFile>?) {
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
        val queue = musicSession?.musicQueue ?: return QueueRemovalResult(false, null)

        val foundIndex =
            queue.songs.indexOf(audioFile).takeIf { it != -1 }
                ?: queue.songs.indexOfFirst { candidate -> candidate.id == audioFile.id }

        if (foundIndex != -1) {
            val mutableSongs = queue.songs.toMutableList()
            val wasLastItem = foundIndex == mutableSongs.lastIndex
            mutableSongs.removeAt(foundIndex)
            queue.songs = mutableSongs
            queue.dedupe = queue.dedupe - audioFile.fingerprint

            when {
                foundIndex < queue.currentSongIndex -> {
                    queue.currentSongIndex -= 1
                }

                foundIndex == queue.currentSongIndex -> {
                    if (wasLastItem) {
                        queue.currentSongIndex -= 1
                    }
                    queue.currentSongIndex = queue.currentSongIndex.coerceAtLeast(0)
                }
            }
        }

        val hasRemaining = queue.songs.isNotEmpty()
        val nextSong = queue.songs.getOrNull(queue.currentSongIndex)

        syncQueue()

        return QueueRemovalResult(
            hasRemainingSongs = hasRemaining,
            nextSong = nextSong,
        )
    }

    fun removeCrate(
        crateId: String,
        kind: String? = null,
    ) {
        val queue = musicSession?.musicQueue ?: return

        val predicate: (AudioFile) -> Boolean =
            when (kind) {
                "artist" -> { song -> song.artist == crateId }
                "album" -> { song -> song.album == crateId }
                else -> { song -> song.id == crateId }
            }

        val removedSongs = queue.songs.filter(predicate)
        if (removedSongs.isEmpty()) return

        val removedFingerprints = removedSongs.map { candidate -> candidate.fingerprint }.toSet()
        val currentSongBeforeRemoval = queue.songs.getOrNull(queue.currentSongIndex)
        val remainingSongs = queue.songs.filterNot(predicate)

        queue.dedupe = queue.dedupe - removedFingerprints
        queue.songs = remainingSongs

        queue.currentSongIndex =
            when {
                remainingSongs.isEmpty() -> {
                    0
                }

                currentSongBeforeRemoval != null && remainingSongs.indexOf(currentSongBeforeRemoval) != -1 -> {
                    remainingSongs.indexOf(currentSongBeforeRemoval)
                }

                else -> {
                    queue.currentSongIndex.coerceIn(0, remainingSongs.lastIndex)
                }
            }

        syncQueue()
    }

    fun reorderQueue(
        updatedList: List<AudioFile>,
        currentAudioFileId: String? = null,
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
        if (queue.songs.isEmpty()) return null

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

    fun setQueueIndexBySongId(songId: String) {
        val queue = musicSession?.musicQueue ?: return
        val targetIndex = queue.songs.indexOfFirst { candidate -> candidate.id == songId }
        if (targetIndex != -1) {
            queue.currentSongIndex = targetIndex
            syncQueue()
        }
    }
}
