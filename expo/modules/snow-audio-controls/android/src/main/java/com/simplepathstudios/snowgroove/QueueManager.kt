package com.simplepathstudios.snowgroove.audiocontrols

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

data class QueueSong(
    val album: String,
    val artist: String,
    val artworkUrl: String?,
    val duration: Long,
    val fingerprint: String,
    val id: String,
    val streamUrl: String,
    val title: String,
)

class QueueManager(
    private val apiClient: SnowgrooveApiClient,
    private val onQueueStale: () -> Unit,
) {
    private val scope = CoroutineScope(Dispatchers.Main + Job())

    var sessionId: String? = null
        private set

    var currentSongIndex: Int = 0
        private set

    val songs = mutableListOf<QueueSong>()
    private var rawQueueObject: JSONObject? = null

    var apiBaseUrl: String? = null
    var authToken: String? = null

    fun configureCredentials(
        baseUrl: String?,
        token: String?,
        initialSessionId: String? = null,
    ) {
        if (SnowEvents.DEBUG_ANDROID_AUDIO) {
            SnowEvents.log(
                "QueueManager->configureCredentials",
                "baseUrl: ${baseUrl ?: "[null]"}, sessionId: ${initialSessionId ?: "[none]"}",
            )
        }
        apiBaseUrl = baseUrl
        authToken = token
        if (!initialSessionId.isNullOrEmpty()) {
            sessionId = initialSessionId
        }
    }

    fun loadSession(
        playerId: String?,
        onLoaded: ((QueueSong?) -> Unit)? = null,
    ) {
        val baseUrl = apiBaseUrl ?: return
        val token = authToken ?: return

        if (SnowEvents.DEBUG_ANDROID_AUDIO) {
            SnowEvents.log("QueueManager->loadSession", "playerId: ${playerId ?: "[null]"}")
        }

        scope.launch {
            val sessionJson = apiClient.getMusicSession(baseUrl, token, playerId)
            if (sessionJson == null) {
                if (SnowEvents.DEBUG_ANDROID_AUDIO) {
                    SnowEvents.log("QueueManager->loadSession", "Failed to retrieve session JSON")
                }
                return@launch
            }
            parseSession(sessionJson)
            val currentSong = getCurrentSong()
            onLoaded?.invoke(currentSong)
        }
    }

    fun parseSession(sessionJson: JSONObject) {
        sessionId = sessionJson.optString("id", null)
        val queueJson = sessionJson.optJSONObject("music_queue")
        if (queueJson == null) {
            if (SnowEvents.DEBUG_ANDROID_AUDIO) {
                SnowEvents.log("QueueManager->parseSession", "Missing music_queue object in session")
            }
            return
        }
        rawQueueObject = queueJson

        currentSongIndex = queueJson.optInt("current_song_index", 0)
        val songArray = queueJson.optJSONArray("songs") ?: JSONArray()

        if (SnowEvents.DEBUG_ANDROID_AUDIO) {
            SnowEvents.log(
                "QueueManager->parseSession",
                "Parsing ${songArray.length()} songs, target index: $currentSongIndex, sessionId: ${sessionId ?: "[none]"}",
            )
        }

        songs.clear()
        for (ii in 0 until songArray.length()) {
            val item = songArray.optJSONObject(ii) ?: continue
            val songId = item.optString("id", "")
            val fingerprint = item.optString("fingerprint", "")
            val title = item.optString("title", "")
            val artist = item.optString("artist", "")
            val album = item.optString("album", "")
            val duration = item.optLong("duration", 0L)
            val artworkUrl =
                item.optString("thumbnail_web_path").takeIf { !it.isNullOrEmpty() }
                    ?: item.optString("artwork_url").takeIf { !it.isNullOrEmpty() }
            val streamUrl = item.optString("web_path", "")

            if (SnowEvents.DEBUG_ANDROID_AUDIO && streamUrl.isEmpty()) {
                SnowEvents.log("QueueManager->parseSession", "Warning: empty stream_url for song[$ii]: $title")
            }

            songs.add(
                QueueSong(
                    id = songId,
                    fingerprint = fingerprint,
                    title = title,
                    artist = artist,
                    album = album,
                    duration = duration,
                    artworkUrl = artworkUrl,
                    streamUrl = streamUrl,
                ),
            )
        }

        if (songs.isNotEmpty()) {
            currentSongIndex = currentSongIndex.coerceIn(0, songs.size - 1)
        } else {
            currentSongIndex = 0
        }

        if (SnowEvents.DEBUG_ANDROID_AUDIO) {
            SnowEvents.log("QueueManager->parseSession", "Loaded ${songs.size} songs. Active index: $currentSongIndex")
        }
    }

    fun getCurrentSong(): QueueSong? {
        if (songs.isEmpty() || currentSongIndex !in songs.indices) {
            if (SnowEvents.DEBUG_ANDROID_AUDIO) {
                SnowEvents.log(
                    "QueueManager->getCurrentSong",
                    "No song available (songs size: ${songs.size}, index: $currentSongIndex)",
                )
            }
            return null
        }
        val currentSong = songs[currentSongIndex]
        if (SnowEvents.DEBUG_ANDROID_AUDIO) {
            SnowEvents.log(
                "QueueManager->getCurrentSong",
                "index: $currentSongIndex, title: ${currentSong.title}, streamUrl: ${currentSong.streamUrl}",
            )
        }
        return currentSong
    }

    fun advanceSong(amount: Int): QueueSong? {
        if (songs.isEmpty()) {
            if (SnowEvents.DEBUG_ANDROID_AUDIO) {
                SnowEvents.log("QueueManager->advanceSong", "Aborting: queue is empty")
            }
            return null
        }

        val previousIndex = currentSongIndex
        currentSongIndex += amount
        if (currentSongIndex < 0) {
            currentSongIndex = songs.size - 1
        } else if (currentSongIndex > songs.size - 1) {
            currentSongIndex = 0
        }

        val nextSong = songs[currentSongIndex]
        if (SnowEvents.DEBUG_ANDROID_AUDIO) {
            SnowEvents.log(
                "QueueManager->advanceSong",
                "amount: $amount, index: $previousIndex -> $currentSongIndex, title: ${nextSong.title}, streamUrl: ${nextSong.streamUrl}",
            )
        }
        syncQueueIndexToServer()
        return nextSong
    }

    private fun syncQueueIndexToServer() {
        val baseUrl = apiBaseUrl ?: return
        val token = authToken ?: return
        val targetSessionId = sessionId ?: return
        val queueJson = rawQueueObject ?: JSONObject()

        queueJson.put("current_song_index", currentSongIndex)

        if (SnowEvents.DEBUG_ANDROID_AUDIO) {
            SnowEvents.log(
                "QueueManager->syncQueueIndexToServer",
                "Syncing index: $currentSongIndex for sessionId: $targetSessionId",
            )
        }

        scope.launch {
            val isSuccess =
                apiClient.updateMusicSessionQueue(
                    baseUrl = baseUrl,
                    token = token,
                    sessionId = targetSessionId,
                    queueJson = queueJson,
                )
            if (SnowEvents.DEBUG_ANDROID_AUDIO) {
                SnowEvents.log("QueueManager->syncQueueIndexToServer", "Server sync success: $isSuccess")
            }
            if (isSuccess) {
                onQueueStale()
            }
        }
    }
}