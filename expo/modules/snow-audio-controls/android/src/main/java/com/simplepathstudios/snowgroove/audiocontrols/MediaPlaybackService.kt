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

        if (SnowEvents.DEBUG_ANDROID_AUDIO) {
            SnowEvents.log("MediaPlaybackService->onCreate", "Initializing service")
        }

        notificationManager = PlaybackNotificationManager(this)

        queueManager = QueueManager()

        audioPlaybackManager =
            AudioPlaybackManager(
                context = this,
                onPlaybackStateChange = { isPlaying ->
                    if (SnowEvents.DEBUG_ANDROID_AUDIO) {
                        SnowEvents.log("MediaPlaybackService->onPlaybackStateChange", "isPlaying: $isPlaying")
                    }
                    notificationManager.updateNotification(
                        audioPlaybackManager.mediaSession!!,
                        currentTitle,
                        currentArtist,
                        isPlaying,
                        cachedArtworkBitmap,
                    )
                },
                onItemFinished = {
                    if (SnowEvents.DEBUG_ANDROID_AUDIO) {
                        SnowEvents.log("MediaPlaybackService->onItemFinished", "Current track finished")
                    }
                    val nextSong = queueManager.advanceSong(1)
                    if (nextSong != null) {
                        loadAndPlay()
                        onCommand?.invoke("trackChanged", mapOf("songFingerprint" to nextSong.fingerprint))
                    } else {
                        onFinished?.invoke()
                    }
                },
                onCommandAction = { action, payload ->
                    if (SnowEvents.DEBUG_ANDROID_AUDIO) {
                        SnowEvents.log("MediaPlaybackService->onCommandAction", "action: $action, isRemoteMode: $isRemoteMode")
                    }
                    if (!isRemoteMode && (action == "next" || action == "previous")) {
                        val step = if (action == "next") 1 else -1
                        val nextSong = queueManager.advanceSong(step)
                        if (nextSong != null) {
                            loadAndPlay()
                            return@AudioPlaybackManager
                        }
                    }
                    onCommand?.invoke(action, payload)
                },
                onSeekAction = { seconds ->
                    if (SnowEvents.DEBUG_ANDROID_AUDIO) {
                        SnowEvents.log("MediaPlaybackService->onSeekAction", "seconds: $seconds")
                    }
                    seek(seconds)
                },
            )

        volumeManager = VolumeManager(context = this)

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
        if (SnowEvents.DEBUG_ANDROID_AUDIO) {
            SnowEvents.log("MediaPlaybackService->onStartCommand", "action: ${intent?.action ?: "[null]"}")
        }
        MediaButtonReceiver.handleIntent(audioPlaybackManager.mediaSession, intent)
        return START_STICKY
    }

    fun requestQueueSync() {
        if (SnowEvents.DEBUG_ANDROID_AUDIO) {
            SnowEvents.log("MediaPlaybackService->requestQueueSync", "Requesting sync")
        }
        serviceScope.launch(Dispatchers.Main) {
            queueManager.loadSession(null)
        }
    }

    fun setRemoteControlMode(
        enabled: Boolean,
        initialVolumePercent: Float,
    ) {
        if (SnowEvents.DEBUG_ANDROID_AUDIO) {
            SnowEvents.log("MediaPlaybackService->setRemoteControlMode", "enabled: $enabled, volume: $initialVolumePercent")
        }
        serviceScope.launch(Dispatchers.Main) {
            val session = audioPlaybackManager.mediaSession ?: return@launch
            isRemoteMode = enabled
            audioPlaybackManager.setMode(enabled)

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
        if (SnowEvents.DEBUG_ANDROID_AUDIO) {
            SnowEvents.log("MediaPlaybackService->adjustRemoteVolumeByDelta", "delta: $delta, isRemoteMode: $isRemoteMode")
        }
        serviceScope.launch(Dispatchers.Main) {
            if (!isRemoteMode) return@launch
            volumeManager.adjustRemoteVolumeByDelta(delta)
        }
    }

    fun syncRemoteVolume(percent: Float) {
        if (SnowEvents.DEBUG_ANDROID_AUDIO) {
            SnowEvents.log("MediaPlaybackService->syncRemoteVolume", "percent: $percent")
        }
        serviceScope.launch(Dispatchers.Main) {
            volumeManager.syncRemoteVolume(percent)
        }
    }

    fun loadAndPlay() {
        serviceScope.launch(Dispatchers.Main) {
            val currentSong = queueManager.currentSong
            if (SnowEvents.DEBUG_ANDROID_AUDIO) {
                SnowEvents.log("MediaPlaybackService->loadAndPlay", currentSong?.thumbnailWebPath ?: "[empty]")
            }
            setRemoteControlMode(false, volumeManager.targetVolume)
            audioPlaybackManager.loadAndPlay(currentSong?.streamUrl ?: "", volumeManager.targetVolume)

            val bitmap = resolveArtworkBitmap(currentSong?.thumbnailWebPath)
            audioPlaybackManager.updateMetadata(
                currentSong?.title,
                currentSong?.artist,
                currentSong?.album,
                currentSong?.duration,
                bitmap,
            )
            audioPlaybackManager.syncSessionPlaybackState(true)
            audioPlaybackManager.mediaSession?.let { mediaSession ->
                notificationManager.updateNotification(
                    mediaSession,
                    currentSong?.title,
                    currentSong?.artist,
                    true,
                    bitmap,
                )
            }
        }
    }

    fun play() {
        if (SnowEvents.DEBUG_ANDROID_AUDIO) {
            SnowEvents.log("MediaPlaybackService->play", "isRemoteMode: $isRemoteMode")
        }
        serviceScope.launch(Dispatchers.Main) {
            if (!isRemoteMode) {
                audioPlaybackManager.play(volumeManager.targetVolume)
            }
            val currentSong = queueManager.currentSong
            audioPlaybackManager.syncSessionPlaybackState(true)
            audioPlaybackManager.mediaSession?.let { mediaSession ->
                notificationManager.updateNotification(
                    mediaSession,
                    currentSong?.title,
                    currentSong?.artist,
                    true,
                    cachedArtworkBitmap,
                )
            }
        }
    }

    fun pause() {
        if (SnowEvents.DEBUG_ANDROID_AUDIO) {
            SnowEvents.log("MediaPlaybackService->pause", "isRemoteMode: $isRemoteMode")
        }
        serviceScope.launch(Dispatchers.Main) {
            if (!isRemoteMode) {
                audioPlaybackManager.pause()
            }
            val currentSong = queueManager.currentSong
            audioPlaybackManager.syncSessionPlaybackState(false)
            audioPlaybackManager.mediaSession?.let { mediaSession ->
                notificationManager.updateNotification(
                    mediaSession,
                    currentSong?.title,
                    currentSong?.artist,
                    false,
                    cachedArtworkBitmap,
                )
            }
        }
    }

    fun stop() {
        if (SnowEvents.DEBUG_ANDROID_AUDIO) {
            SnowEvents.log("MediaPlaybackService->stop", "Stopping playback")
        }
        serviceScope.launch(Dispatchers.Main) {
            audioPlaybackManager.stop()
            audioPlaybackManager.syncSessionPlaybackState(false)
            notificationManager.stopForegroundNotification()
        }
    }

    fun seek(seconds: Double) {
        if (SnowEvents.DEBUG_ANDROID_AUDIO) {
            SnowEvents.log("MediaPlaybackService->seek", "seconds: $seconds, isRemoteMode: $isRemoteMode")
        }
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
        if (SnowEvents.DEBUG_ANDROID_AUDIO) {
            SnowEvents.log("MediaPlaybackService->setVolumeLevel", "percent: $percent, isRemoteMode: $isRemoteMode")
        }
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
                    delay(SnowConfig.REMOTE_POLLING_DELAY_MILLISECONDS)
                }
            }
    }

    private suspend fun resolveArtworkBitmap(artworkUrl: String?): Bitmap? {
        if (artworkUrl.isNullOrEmpty()) {
            if (SnowEvents.DEBUG_ANDROID_AUDIO) {
                SnowEvents.log("MediaPlaybackService->resolveArtworkBitmap", "Artwork URL null or empty")
            }
            currentArtworkUrl = null
            cachedArtworkBitmap = null
            return null
        }
        if (artworkUrl == currentArtworkUrl && cachedArtworkBitmap != null) {
            if (SnowEvents.DEBUG_ANDROID_AUDIO) {
                SnowEvents.log("MediaPlaybackService->resolveArtworkBitmap", "Returning cached bitmap")
            }
            return cachedArtworkBitmap
        }
        if (SnowEvents.DEBUG_ANDROID_AUDIO) {
            SnowEvents.log("MediaPlaybackService->resolveArtworkBitmap", "Fetching bitmap: $artworkUrl")
        }
        val downloaded = ApiClient.fetchBitmap(artworkUrl)
        currentArtworkUrl = artworkUrl
        cachedArtworkBitmap = downloaded
        return downloaded
    }

    fun updateRemoteMetadata() {
        val currentSong = queueManager.currentSong

        serviceScope.launch(Dispatchers.Main) {
            if (SnowEvents.DEBUG_ANDROID_AUDIO) {
                SnowEvents.log(
                    "MediaPlaybackService->updateRemoteMetadata",
                    "$currentSong?.title by $currentSong?.artist",
                )
            }
            val bitmap = resolveArtworkBitmap(currentSong?.thumbnailWebPath)
            audioPlaybackManager.updateMetadata(
                currentSong?.title,
                currentSong?.artist,
                currentSong?.album,
                currentSong?.duration,
                bitmap,
            )
            audioPlaybackManager.mediaSession?.let { mediaSession ->
                notificationManager.updateNotification(
                    mediaSession,
                    currentSong?.title,
                    currentSong?.artist,
                    true,
                    bitmap,
                )
            }
        }
    }

    override fun onDestroy() {
        if (SnowEvents.DEBUG_ANDROID_AUDIO) {
            SnowEvents.log("MediaPlaybackService->onDestroy", "Destroying service")
        }
        progressJob?.cancel()
        volumeManager.cleanup()
        serviceScope.launch(Dispatchers.Main) {
            audioPlaybackManager.cleanup()
        }
        ApiClient.cleanup()
        cachedArtworkBitmap = null
        super.onDestroy()
    }
}
