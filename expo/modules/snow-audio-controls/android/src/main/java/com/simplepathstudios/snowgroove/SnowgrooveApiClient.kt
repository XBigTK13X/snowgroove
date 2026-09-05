package com.simplepathstudios.snowgroove.audiocontrols

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.PowerManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStream
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

class SnowgrooveApiClient {
    fun sendRemoteVolume(
        baseUrl: String,
        token: String,
        sessionId: String,
        percent: Double,
        wakeLock: PowerManager.WakeLock?,
    ) {
        thread(start = true) {
            try {
                wakeLock?.acquire(4000)
            } catch (ignored: Exception) {
            }

            var connection: HttpURLConnection? = null
            try {
                val cleanedBaseUrl = baseUrl.trimEnd('/')
                val targetUrl = URL("$cleanedBaseUrl/music-session/volume")
                connection =
                    (targetUrl.openConnection() as HttpURLConnection).apply {
                        requestMethod = "POST"
                        doOutput = true
                        connectTimeout = 4000
                        readTimeout = 4000
                        setRequestProperty("Content-Type", "application/json")
                        setRequestProperty("Authorization", "Bearer $token")
                    }

                val payload = "{\"music_session_id\":\"$sessionId\",\"volume_percent\":$percent}"
                OutputStreamWriter(connection.outputStream).use { writer ->
                    writer.write(payload)
                    writer.flush()
                }

                connection.responseCode
            } catch (ignored: Exception) {
            } finally {
                try {
                    connection?.disconnect()
                } catch (ignored: Exception) {
                }
                try {
                    if (wakeLock?.isHeld == true) {
                        wakeLock?.release()
                    }
                } catch (ignored: Exception) {
                }
            }
        }
    }

    suspend fun getMusicSession(
        baseUrl: String,
        token: String,
        playerId: String?,
    ): JSONObject? =
        withContext(Dispatchers.IO) {
            var connection: HttpURLConnection? = null
            try {
                val cleanedBaseUrl = baseUrl.trimEnd('/')
                val endpoint =
                    if (!playerId.isNullOrEmpty()) {
                        "$cleanedBaseUrl/music-session?player_id=$playerId"
                    } else {
                        "$cleanedBaseUrl/music-session"
                    }
                val targetUrl = URL(endpoint)
                connection =
                    (targetUrl.openConnection() as HttpURLConnection).apply {
                        requestMethod = "GET"
                        connectTimeout = 5000
                        readTimeout = 5000
                        setRequestProperty("Content-Type", "application/json")
                        setRequestProperty("Authorization", "Bearer $token")
                    }

                if (connection.responseCode in 200..299) {
                    val responseText = connection.inputStream.bufferedReader().use(BufferedReader::readText)
                    JSONObject(responseText)
                } else {
                    null
                }
            } catch (ignored: Exception) {
                null
            } finally {
                try {
                    connection?.disconnect()
                } catch (ignored: Exception) {
                }
            }
        }

    suspend fun updateMusicSessionQueue(
        baseUrl: String,
        token: String,
        sessionId: String,
        queueJson: JSONObject,
    ): Boolean =
        withContext(Dispatchers.IO) {
            var connection: HttpURLConnection? = null
            try {
                val cleanedBaseUrl = baseUrl.trimEnd('/')
                val targetUrl = URL("$cleanedBaseUrl/music-session/$sessionId/queue")
                connection =
                    (targetUrl.openConnection() as HttpURLConnection).apply {
                        requestMethod = "POST"
                        doOutput = true
                        connectTimeout = 5000
                        readTimeout = 5000
                        setRequestProperty("Content-Type", "application/json")
                        setRequestProperty("Authorization", "Bearer $token")
                    }

                OutputStreamWriter(connection.outputStream).use { writer ->
                    writer.write(queueJson.toString())
                    writer.flush()
                }

                connection.responseCode in 200..299
            } catch (ignored: Exception) {
                false
            } finally {
                try {
                    connection?.disconnect()
                } catch (ignored: Exception) {
                }
            }
        }

    suspend fun fetchBitmap(src: String): Bitmap? =
        withContext(Dispatchers.IO) {
            var connection: HttpURLConnection? = null
            var inputStream: InputStream? = null
            try {
                val targetUrl = URL(src)
                connection =
                    (targetUrl.openConnection() as HttpURLConnection).apply {
                        doInput = true
                        connectTimeout = 8000
                        readTimeout = 8000
                        instanceFollowRedirects = true
                        setRequestProperty("User-Agent", "Snowgroove/1.0")
                        connect()
                    }
                if (connection.responseCode == HttpURLConnection.HTTP_OK) {
                    inputStream = connection.inputStream
                    BitmapFactory.decodeStream(inputStream)
                } else {
                    null
                }
            } catch (ignored: Exception) {
                null
            } finally {
                try {
                    inputStream?.close()
                } catch (ignored: Exception) {
                }
                try {
                    connection?.disconnect()
                } catch (ignored: Exception) {
                }
            }
        }
}
