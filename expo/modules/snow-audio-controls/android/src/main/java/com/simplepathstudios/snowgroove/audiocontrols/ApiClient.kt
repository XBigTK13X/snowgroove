package com.simplepathstudios.snowgroove.audiocontrols

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.PowerManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Headers
import retrofit2.http.POST
import retrofit2.http.Query
import retrofit2.http.Url
import java.util.concurrent.TimeUnit

interface SnowgrooveService {
    @POST("music-session/play")
    suspend fun playMusicSession(
        @Body payload: JsonElement,
    ): Response<Unit>

    @POST("music-session/pause")
    suspend fun pauseMusicSession(
        @Body payload: JsonElement,
    ): Response<Unit>

    @POST("music-session/stop")
    suspend fun stopMusicSession(
        @Body payload: JsonElement,
    ): Response<Unit>

    @POST("music-session/seek")
    suspend fun seekMusicSession(
        @Body payload: JsonElement,
    ): Response<Unit>

    @POST("music-session/volume")
    suspend fun sendVolume(
        @Body payload: Volume,
    ): Response<Unit>

    @GET("music-session")
    suspend fun getMusicSession(
        @Query("remote_player_id") remotePlayerId: Int?,
        @Query("remote_player_name") remotePlayerName: String?,
    ): Response<MusicSession>

    @POST("music-session")
    suspend fun updateMusicSession(
        @Body musicSession: MusicSession,
    ): Response<Unit>

    @GET("remote-player/status")
    suspend fun getRemotePlayerStatus(
        @Query("remote_player_id") remotePlayerId: Int,
    ): Response<PlayerStatus>

    @GET
    @Headers("User-Agent: Snowgroove/1.0")
    suspend fun fetchBitmapStream(
        @Url url: String,
    ): Response<ResponseBody>
}

object ApiClient {
    @Volatile
    private var service: SnowgrooveService? = null

    @Volatile
    private var apiUrl: String? = null

    @Volatile
    private var authToken: String? = null

    private val json =
        Json {
            ignoreUnknownKeys = true
            isLenient = true
        }

    fun configure(
        baseUrl: String,
        token: String,
    ) {
        authToken = token
        val sanitizedBaseUrl = baseUrl.trimEnd('/') + "/"
        apiUrl = sanitizedBaseUrl

        val authInterceptor =
            Interceptor { chain ->
                val originalRequest = chain.request()
                val currentToken = authToken
                val requestBuilder = originalRequest.newBuilder()

                if (!currentToken.isNullOrBlank() && originalRequest.header("Authorization") == null) {
                    requestBuilder.header("Authorization", "Bearer $currentToken")
                }

                chain.proceed(requestBuilder.build())
            }

        val httpClient =
            OkHttpClient
                .Builder()
                .connectTimeout(5, TimeUnit.SECONDS)
                .readTimeout(5, TimeUnit.SECONDS)
                .addInterceptor(authInterceptor)
                .build()

        val contentType = "application/json".toMediaType()

        service =
            Retrofit
                .Builder()
                .baseUrl(sanitizedBaseUrl)
                .client(httpClient)
                .addConverterFactory(json.asConverterFactory(contentType))
                .build()
                .create(SnowgrooveService::class.java)
    }

    fun updateToken(token: String) {
        authToken = token
    }

    private fun requireService(): SnowgrooveService = service ?: throw IllegalStateException("ApiClient must be configured before use")

    fun playMusicSession(
        sessionId: Int,
        wakeLock: PowerManager.WakeLock? = null,
    ) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                wakeLock?.acquire(SnowConfig.WAKE_LOCK_TIMEOUT_MILLISECONDS)
                val payload =
                    buildJsonObject {
                        put("music_session_id", sessionId)
                    }
                requireService().playMusicSession(payload)
            } catch (ignored: Exception) {
            } finally {
                try {
                    if (wakeLock?.isHeld == true) {
                        wakeLock?.release()
                    }
                } catch (ignored: Exception) {
                }
            }
        }
    }

    fun pauseMusicSession(
        sessionId: Int,
        wakeLock: PowerManager.WakeLock? = null,
    ) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                wakeLock?.acquire(SnowConfig.WAKE_LOCK_TIMEOUT_MILLISECONDS)
                val payload =
                    buildJsonObject {
                        put("music_session_id", sessionId)
                    }
                requireService().pauseMusicSession(payload)
            } catch (ignored: Exception) {
            } finally {
                try {
                    if (wakeLock?.isHeld == true) {
                        wakeLock?.release()
                    }
                } catch (ignored: Exception) {
                }
            }
        }
    }

    fun stopMusicSession(
        sessionId: Int,
        wakeLock: PowerManager.WakeLock? = null,
    ) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                wakeLock?.acquire(SnowConfig.WAKE_LOCK_TIMEOUT_MILLISECONDS)
                val payload =
                    buildJsonObject {
                        put("music_session_id", sessionId)
                    }
                requireService().stopMusicSession(payload)
            } catch (ignored: Exception) {
            } finally {
                try {
                    if (wakeLock?.isHeld == true) {
                        wakeLock?.release()
                    }
                } catch (ignored: Exception) {
                }
            }
        }
    }

    fun seekMusicSession(
        sessionId: Int,
        seekToSeconds: Double,
        wakeLock: PowerManager.WakeLock? = null,
    ) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                wakeLock?.acquire(SnowConfig.WAKE_LOCK_TIMEOUT_MILLISECONDS)
                val parsedSessionId = sessionId
                val parsedSeekSeconds = seekToSeconds.toInt()
                val payload =
                    buildJsonObject {
                        put("music_session_id", parsedSessionId)
                        put("seek_to_seconds", parsedSeekSeconds)
                    }
                requireService().seekMusicSession(payload)
            } catch (ignored: Exception) {
            } finally {
                try {
                    if (wakeLock?.isHeld == true) {
                        wakeLock?.release()
                    }
                } catch (ignored: Exception) {
                }
            }
        }
    }

    fun setRemoteVolume(
        sessionId: Int,
        percent: Double,
        wakeLock: PowerManager.WakeLock? = null,
    ) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                wakeLock?.acquire(SnowConfig.WAKE_LOCK_TIMEOUT_MILLISECONDS)
                val boundedVolume = percent.coerceIn(0.0, 1.0)
                val payload = Volume(musicSessionId = sessionId, volumePercent = boundedVolume)
                requireService().sendVolume(payload)
            } catch (ignored: Exception) {
            } finally {
                try {
                    if (wakeLock?.isHeld == true) {
                        wakeLock?.release()
                    }
                } catch (exception: Exception) {
                    if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
                        SnowEvents.log(
                            "ApiClient->setRemoteVolume",
                            "Exception setting remote volume: ${exception.javaClass.simpleName} - ${exception.message}",
                        )
                    }
                    null
                }
            }
        }
    }

    suspend fun getMusicSession(
        remotePlayerId: Int?,
        remotePlayerName: String?,
    ): MusicSession? =
        try {
            if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
                SnowEvents.log(
                    "ApiClient->getMusicSession",
                    "url: $apiUrl, id: $remotePlayerId, name: $remotePlayerName, token: $authToken",
                )
            }
            val response = requireService().getMusicSession(remotePlayerId, remotePlayerName)
            if (response.isSuccessful) {
                val session = response.body()
                if (session == null && SnowConfig.DEBUG_ANDROID_AUDIO != null) {
                    SnowEvents.log(
                        "ApiClient->getMusicSession",
                        "Successful response code ${response.code()} returned null body",
                    )
                }
                session
            } else {
                if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
                    val errorDetails = response.errorBody()?.string()?.takeIf { it.isNotBlank() } ?: "None"
                    SnowEvents.log(
                        "ApiClient->getMusicSession",
                        "Unsuccessful response code ${response.code()} message: ${response.message()}, error body: $errorDetails",
                    )
                }
                null
            }
        } catch (exception: Exception) {
            if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
                SnowEvents.log(
                    "ApiClient->getMusicSession",
                    "Exception fetching music session: ${exception.javaClass.simpleName} - ${exception.message}",
                )
            }
            null
        }

    suspend fun updateMusicSession(
        sessionId: Int,
        queue: MusicQueue,
    ): Boolean =
        try {
            val updatedSession =
                MusicSession(
                    writeId = sessionId,
                    musicQueue = queue,
                )
            val response = requireService().updateMusicSession(updatedSession)
            response.isSuccessful
        } catch (exception: Exception) {
            if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
                SnowEvents.log(
                    "ApiClient->updateMusicSession",
                    "Exception updating queue: ${exception.javaClass.simpleName} - ${exception.message}",
                )
            }
            false
        }

    suspend fun getRemotePlayerStatus(remotePlayerId: Int): PlayerStatus? =
        try {
            if (SnowConfig.DEBUG_ANDROID_AUDIO == "verbose") {
                SnowEvents.log(
                    "ApiClient->getRemotePlayerStatus",
                    "id: $remotePlayerId",
                )
            }
            val response = requireService().getRemotePlayerStatus(remotePlayerId)
            if (response.isSuccessful) {
                val player = response.body()
                if (player == null && SnowConfig.DEBUG_ANDROID_AUDIO != null) {
                    SnowEvents.log(
                        "ApiClient->getRemotePlayerStatus",
                        "Successful response code ${response.code()} returned null body",
                    )
                }
                player
            } else {
                if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
                    val errorDetails = response.errorBody()?.string()?.takeIf { it.isNotBlank() } ?: "None"
                    SnowEvents.log(
                        "ApiClient->getRemotePlayerStatus",
                        "Unsuccessful response code ${response.code()} message: ${response.message()}, error body: $errorDetails",
                    )
                }
                null
            }
        } catch (exception: Exception) {
            if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
                SnowEvents.log(
                    "ApiClient->getRemotePlayerStatus",
                    "Exception fetching remote player: ${exception.javaClass.simpleName} - ${exception.message}",
                )
            }
            null
        }

    suspend fun fetchBitmap(src: String): Bitmap? =
        try {
            val response = requireService().fetchBitmapStream(src)
            response.body()?.byteStream()?.use { stream ->
                BitmapFactory.decodeStream(stream)
            }
        } catch (exception: Exception) {
            if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
                SnowEvents.log(
                    "ApiClient->fetchBitmap",
                    "Exception fetching bitmap: ${exception.javaClass.simpleName} - ${exception.message}",
                )
            }
            null
        }

    fun cleanup() =
        try {
            service = null
        } catch (ignored: Exception) {
            null
        }
}
