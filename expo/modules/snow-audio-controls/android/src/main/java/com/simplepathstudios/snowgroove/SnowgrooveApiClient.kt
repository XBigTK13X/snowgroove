package com.simplepathstudios.snowgroove.audiocontrols

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.PowerManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.ResponseBody
import org.json.JSONObject
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.scalars.ScalarsConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.Headers
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query
import retrofit2.http.Url
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit

interface SnowgrooveService {
    @POST("music-session/volume")
    suspend fun sendVolume(
        @Header("Authorization") token: String,
        @Body payload: String,
    ): Response<Unit>

    @GET("music-session")
    suspend fun getMusicSession(
        @Header("Authorization") token: String,
        @Query("player_id") playerId: String?,
    ): Response<String>

    @POST("music-session/{sessionId}/queue")
    suspend fun updateQueue(
        @Header("Authorization") token: String,
        @Path("sessionId") sessionId: String,
        @Body queueJson: String,
    ): Response<Unit>

    @GET
    @Headers("User-Agent: Snowgroove/1.0")
    suspend fun fetchBitmapStream(
        @Url url: String,
    ): Response<ResponseBody>
}

class SnowgrooveApiClient {
    private val httpClient: OkHttpClient =
        OkHttpClient.Builder()
            .connectTimeout(5, TimeUnit.SECONDS)
            .readTimeout(5, TimeUnit.SECONDS)
            .build()

    private val services = ConcurrentHashMap<String, SnowgrooveService>()

    private fun getService(baseUrl: String): SnowgrooveService {
        val sanitizedBaseUrl = baseUrl.trimEnd('/') + "/"
        return services.computeIfAbsent(sanitizedBaseUrl) { url ->
            Retrofit.Builder()
                .baseUrl(url)
                .client(httpClient)
                .addConverterFactory(ScalarsConverterFactory.create())
                .build()
                .create(SnowgrooveService::class.java)
        }
    }

    fun sendRemoteVolume(
        baseUrl: String,
        token: String,
        sessionId: String,
        percent: Double,
        wakeLock: PowerManager.WakeLock?,
    ) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                wakeLock?.acquire(4000)
                val payload = "{\"music_session_id\":\"$sessionId\",\"volume_percent\":$percent}"
                getService(baseUrl).sendVolume("Bearer $token", payload)
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

    suspend fun getMusicSession(
        baseUrl: String,
        token: String,
        playerId: String?,
    ): JSONObject? {
        return try {
            val response = getService(baseUrl).getMusicSession("Bearer $token", playerId)
            if (response.isSuccessful) {
                response.body()?.let { JSONObject(it) }
            } else {
                null
            }
        } catch (ignored: Exception) {
            null
        }
    }

    suspend fun updateMusicSessionQueue(
        baseUrl: String,
        token: String,
        sessionId: String,
        queueJson: JSONObject,
    ): Boolean {
        return try {
            val response = getService(baseUrl).updateQueue("Bearer $token", sessionId, queueJson.toString())
            response.isSuccessful
        } catch (ignored: Exception) {
            false
        }
    }

    suspend fun fetchBitmap(src: String): Bitmap? {
        return try {
            val defaultBaseUrl = "https://localhost/"
            val response = getService(defaultBaseUrl).fetchBitmapStream(src)
            response.body()?.byteStream()?.use { stream ->
                BitmapFactory.decodeStream(stream)
            }
        } catch (ignored: Exception) {
            null
        }
    }
}