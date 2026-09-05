package com.simplepathstudios.snowgroove.audiocontrols

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

data class QueueSong(
    val id: String,
    val title: String,
    val artist: String,
    val album: String,
    val duration: Long,
    val artworkUrl: String?,
    val streamUrl: String,
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

        scope.launch {
            val sessionJson = apiClient.getMusicSession(baseUrl, token, playerId) ?: return@launch
            parseSession(sessionJson)
            val currentSong = getCurrentSong()
            onLoaded?.invoke(currentSong)
        }
    }

    fun parseSession(sessionJson: JSONObject) {
        sessionId = sessionJson.optString("id", null)
        val queueJson = sessionJson.optJSONObject("music_queue") ?: return
        rawQueueObject = queueJson

        currentSongIndex = queueJson.optInt("current_song_index", 0)
        val songArray = queueJson.optJSONArray("songs") ?: JSONArray()

        songs.clear()
        for (ii in 0 until songArray.length()) {
            val item = songArray.optJSONObject(ii) ?: continue
            val songId = item.optString("id", "")
            val title = item.optString("title", "")
            val artist = item.optString("artist", "")
            val album = item.optString("album", "")
            val duration = item.optLong("duration", 0L)
            val artworkUrl =
                item.optString("thumbnail_web_path").takeIf { !it.isNullOrEmpty() }
                    ?: item.optString("artwork_url").takeIf { !it.isNullOrEmpty() }
            val streamUrl = item.optString("stream_url", "")

            songs.add(
                QueueSong(
                    id = songId,
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
    }

    fun getCurrentSong(): QueueSong? {
        if (songs.isEmpty() || currentSongIndex !in songs.indices) return null
        return songs[currentSongIndex]
    }

    fun advanceSong(amount: Int): QueueSong? {
        if (songs.isEmpty()) return null

        currentSongIndex += amount
        if (currentSongIndex < 0) {
            currentSongIndex = songs.size - 1
        } else if (currentSongIndex > songs.size - 1) {
            currentSongIndex = 0
        }

        val nextSong = songs[currentSongIndex]
        syncQueueIndexToServer()
        return nextSong
    }

    private fun syncQueueIndexToServer() {
        val baseUrl = apiBaseUrl ?: return
        val token = authToken ?: return
        val targetSessionId = sessionId ?: return
        val queueJson = rawQueueObject ?: JSONObject()

        queueJson.put("current_song_index", currentSongIndex)

        scope.launch {
            val isSuccess =
                apiClient.updateMusicSessionQueue(
                    baseUrl = baseUrl,
                    token = token,
                    sessionId = targetSessionId,
                    queueJson = queueJson,
                )
            if (isSuccess) {
                onQueueStale()
            }
        }
    }
}
