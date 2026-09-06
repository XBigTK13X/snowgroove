package com.simplepathstudios.snowgroove.audiocontrols

import android.app.Service
import android.content.Intent
import android.graphics.Bitmap
import android.media.AudioManager
import android.os.Binder
import android.os.IBinder
import androidx.media.session.MediaButtonReceiver
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MediaPlaybackService : Service() {
    private val binder = LocalBinder()
    private val serviceScope = CoroutineScope(Dispatchers.Main + Job())
    private val apiClient = SnowgrooveApiClient()

    private lateinit var notificationManager: PlaybackNotificationManager
    private lateinit var audioPlaybackManager: AudioPlaybackManager
    private lateinit var volumeManager: VolumeManager
    private lateinit var queueManager: QueueManager

    var onCommand: ((String, Map<String, Any>?) -> Unit)? = null
    var onStatusUpdate: ((Map<String, Any>) -> Unit)? = null
    var onFinished: (() -> Unit)? = null

    private var currentTitle = ""
    private var currentArtist = ""
    private var currentAlbum = ""
    private var currentArtworkUrl: String? = null
    private var cachedArtworkBitmap: Bitmap? = null

    private var isRemoteMode = false
    private var progressJob: Job? = null

    inner class LocalBinder : Binder() {
        fun getService(): MediaPlaybackService = this@MediaPlaybackService
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onCreate() {
        super.onCreate()

        notificationManager = PlaybackNotificationManager(this)

        queueManager =
            QueueManager(
                apiClient = apiClient,
                onQueueStale = {
                    onCommand?.invoke("queueStale", null)
                },
            )

        audioPlaybackManager =
            AudioPlaybackManager(
                context = this,
                onPlaybackStateChange = { isPlaying ->
                    notificationManager.updateNotification(
                        audioPlaybackManager.mediaSession!!,
                        currentTitle,
                        currentArtist,
                        isPlaying,
                        cachedArtworkBitmap,
                    )
                },
                onItemFinished = {
                    val nextSong = queueManager.advanceSong(1)
                    if (nextSong != null) {
                        loadAndPlay(
                            uri = nextSong.streamUrl,
                            title = nextSong.title,
                            artist = nextSong.artist,
                            album = nextSong.album,
                            artworkUrl = nextSong.artworkUrl,
                            duration = nextSong.duration,
                        )
                        onCommand?.invoke("trackChanged", mapOf("songId" to nextSong.id))
                    } else {
                        onFinished?.invoke()
                    }
                },
                onCommandAction = { action, payload ->
                    if (!isRemoteMode && (action == "next" || action == "previous")) {
                        val step = if (action == "next") 1 else -1
                        val nextSong = queueManager.advanceSong(step)
                        if (nextSong != null) {
                            loadAndPlay(
                                uri = nextSong.streamUrl,
                                title = nextSong.title,
                                artist = nextSong.artist,
                                album = nextSong.album,
                                artworkUrl = nextSong.artworkUrl,
                                duration = nextSong.duration,
                            )
                            return@AudioPlaybackManager
                        }
                    }
                    onCommand?.invoke(action, payload)
                },
                onSeekAction = { seconds ->
                    seek(seconds)
                },
            )

        volumeManager =
            VolumeManager(
                context = this,
                apiClient = apiClient,
                onVolumeAdjusted = { percent ->
                    onCommand?.invoke("volumeAdjust", mapOf("percent" to percent))
                },
            )

        val initialNotification =
            notificationManager.buildNotification(
                audioPlaybackManager.mediaSession!!,
                "Snowgroove",
                "Ready",
                false,
                null,
            )
        notificationManager.startForegroundService(initialNotification)

        startProgressLoop()
    }

    override fun onStartCommand(
        intent: Intent?,
        flags: Int,
        startId: Int,
    ): Int {
        MediaButtonReceiver.handleIntent(audioPlaybackManager.mediaSession, intent)
        return START_STICKY
    }

    fun setRemoteControlMode(
        enabled: Boolean,
        initialVolumePercent: Float,
        baseUrl: String? = null,
        authToken: String? = null,
        sessionId: String? = null,
    ) {
        serviceScope.launch(Dispatchers.Main) {
            val session = audioPlaybackManager.mediaSession ?: return@launch
            isRemoteMode = enabled
            audioPlaybackManager.setMode(enabled)
            volumeManager.configureRemoteSettings(initialVolumePercent, baseUrl, authToken, sessionId)
            queueManager.configureCredentials(baseUrl, authToken)

            session.setPlaybackToLocal(AudioManager.STREAM_MUSIC)

            if (enabled) {
                audioPlaybackManager.stop()
                volumeManager.registerObserver()
                session.isActive = true
                audioPlaybackManager.syncSessionPlaybackState(true)
            } else {
                volumeManager.unregisterObserver()
            }
        }
    }

    fun adjustRemoteVolumeByDelta(delta: Double) {
        serviceScope.launch(Dispatchers.Main) {
            if (!isRemoteMode) return@launch
            volumeManager.adjustRemoteVolumeByDelta(delta)
        }
    }

    fun syncRemoteVolume(percent: Float) {
        serviceScope.launch(Dispatchers.Main) {
            volumeManager.syncRemoteVolume(percent)
        }
    }

    fun loadAndPlay(
        uri: String,
        title: String,
        artist: String,
        album: String,
        artworkUrl: String?,
        duration: Long,
    ) {
        currentTitle = title
        currentArtist = artist
        currentAlbum = album

        serviceScope.launch(Dispatchers.Main) {
            setRemoteControlMode(false, volumeManager.targetVolume)
            audioPlaybackManager.loadAndPlay(uri, volumeManager.targetVolume)

            val bitmap = resolveArtworkBitmap(artworkUrl)
            audioPlaybackManager.updateMetadata(currentTitle, currentArtist, currentAlbum, duration, bitmap)
            audioPlaybackManager.syncSessionPlaybackState(true)
            audioPlaybackManager.mediaSession?.let { session ->
                notificationManager.updateNotification(session, currentTitle, currentArtist, true, bitmap)
            }
        }
    }

    fun play() {
        serviceScope.launch(Dispatchers.Main) {
            if (!isRemoteMode) {
                audioPlaybackManager.play(volumeManager.targetVolume)
            }
            audioPlaybackManager.syncSessionPlaybackState(true)
            audioPlaybackManager.mediaSession?.let { session ->
                notificationManager.updateNotification(session, currentTitle, currentArtist, true, cachedArtworkBitmap)
            }
        }
    }

    fun pause() {
        serviceScope.launch(Dispatchers.Main) {
            if (!isRemoteMode) {
                audioPlaybackManager.pause()
            }
            audioPlaybackManager.syncSessionPlaybackState(false)
            audioPlaybackManager.mediaSession?.let { session ->
                notificationManager.updateNotification(session, currentTitle, currentArtist, false, cachedArtworkBitmap)
            }
        }
    }

    fun stop() {
        serviceScope.launch(Dispatchers.Main) {
            audioPlaybackManager.stop()
            audioPlaybackManager.syncSessionPlaybackState(false)
            notificationManager.stopForegroundNotification()
        }
    }

    fun seek(seconds: Double) {
        serviceScope.launch(Dispatchers.Main) {
            val targetMillis = (seconds * 1000).toLong()
            if (!isRemoteMode) {
                audioPlaybackManager.seek(targetMillis)
            } else {
                onCommand?.invoke("seek", mapOf("position" to seconds))
            }

            val isPlaying = if (isRemoteMode) true else audioPlaybackManager.isPlaying()
            audioPlaybackManager.syncSessionPlaybackState(isPlaying, targetMillis)
        }
    }

    fun setVolumeLevel(percent: Float) {
        serviceScope.launch(Dispatchers.Main) {
            volumeManager.setLocalVolumeLevel(percent)
            if (!isRemoteMode) {
                audioPlaybackManager.setVolume(volumeManager.targetVolume)
            }
        }
    }

    private fun startProgressLoop() {
        progressJob?.cancel()
        progressJob =
            serviceScope.launch(Dispatchers.Default) {
                while (isActive) {
                    if (!isRemoteMode) {
                        try {
                            withContext(Dispatchers.Main) {
                                val progress = audioPlaybackManager.getPlayerProgress()
                                if (progress != null) {
                                    onStatusUpdate?.invoke(
                                        mapOf(
                                            "positionMillis" to progress.first,
                                            "durationMillis" to progress.second,
                                            "isPlaying" to audioPlaybackManager.isPlaying(),
                                            "isLoaded" to true,
                                        ),
                                    )
                                }
                            }
                        } catch (ignored: Exception) {
                        }
                    }
                    delay(1000)
                }
            }
    }

    private suspend fun resolveArtworkBitmap(artworkUrl: String?): Bitmap? {
        if (artworkUrl.isNullOrEmpty()) {
            currentArtworkUrl = null
            cachedArtworkBitmap = null
            return null
        }
        if (artworkUrl == currentArtworkUrl && cachedArtworkBitmap != null) {
            return cachedArtworkBitmap
        }
        val downloaded = apiClient.fetchBitmap(artworkUrl)
        currentArtworkUrl = artworkUrl
        cachedArtworkBitmap = downloaded
        return downloaded
    }

    fun updateRemoteMetadata(
        title: String,
        artist: String,
        album: String,
        artworkUrl: String?,
        duration: Long,
        isPlaying: Boolean,
    ) {
        currentTitle = title
        currentArtist = artist
        currentAlbum = album

        serviceScope.launch(Dispatchers.Main) {
            val bitmap = resolveArtworkBitmap(artworkUrl)
            audioPlaybackManager.updateMetadata(currentTitle, currentArtist, currentAlbum, duration, bitmap)
            audioPlaybackManager.syncSessionPlaybackState(isPlaying)
            audioPlaybackManager.mediaSession?.let { session ->
                notificationManager.updateNotification(session, currentTitle, currentArtist, isPlaying, bitmap)
            }
        }
    }

    fun requestQueueSync() {
        serviceScope.launch(Dispatchers.Main) {
            queueManager.loadSession(null)
        }
    }

    fun configureApi(
        baseUrl: String,
        token: String,
        sessionId: String? = null,
    ) {
        queueManager.configureCredentials(baseUrl, token, sessionId)
        volumeManager.remoteApiBaseUrl = baseUrl
        volumeManager.remoteAuthToken = token
        volumeManager.remoteSessionId = sessionId
    }

    override fun onDestroy() {
        progressJob?.cancel()
        volumeManager.release()
        serviceScope.launch(Dispatchers.Main) {
            audioPlaybackManager.release()
        }
        cachedArtworkBitmap = null
        super.onDestroy()
    }
}