package com.simplepathstudios.snowgroove.audiocontrols

import android.app.PendingIntent
import android.app.Service
import android.content.ComponentName
import android.content.Intent
import android.graphics.Bitmap
import android.media.AudioManager
import android.os.Binder
import android.os.IBinder
import android.support.v4.media.session.MediaSessionCompat
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

    private var targetPlayerId: Int? = null
    private var targetPlayerName: String? = null

    lateinit var mediaSession: MediaSessionCompat
        private set

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

        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("MediaPlaybackService->onCreate", "Initializing service")
        }

        initMediaSession()

        notificationManager = PlaybackNotificationManager(this, mediaSession)

        queueManager = QueueManager()

        audioPlaybackManager =
            AudioPlaybackManager(
                context = this,
                mediaSession = mediaSession,
                onPlaybackStateChange = { isPlaying ->
                    if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
                        SnowEvents.log("MediaPlaybackService->onPlaybackStateChange", "isPlaying: $isPlaying")
                    }
                    notificationManager.updateNotification(
                        currentTitle,
                        currentArtist,
                        isPlaying,
                        cachedArtworkBitmap,
                    )
                },
                onItemFinished = {
                    if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
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
            )

        volumeManager = VolumeManager(context = this)

        val initialNotification =
            notificationManager.buildNotification(
                "Snowgroove",
                "Ready",
                false,
                null,
            )
        notificationManager.startForegroundService(initialNotification)

        startProgressLoop()
    }

    private fun initMediaSession() {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("MediaPlaybackService->initMediaSession", "Initializing MediaSessionCompat")
        }
        val mediaButtonReceiver = ComponentName(this, MediaButtonReceiver::class.java)
        mediaSession =
            MediaSessionCompat(this, "SnowgrooveSession", mediaButtonReceiver, null).apply {
                setFlags(
                    MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS or
                        MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS,
                )

                val mediaButtonIntent =
                    Intent(Intent.ACTION_MEDIA_BUTTON).apply {
                        setClass(this@MediaPlaybackService, MediaButtonReceiver::class.java)
                    }
                val pendingIntent =
                    PendingIntent.getBroadcast(
                        this@MediaPlaybackService,
                        0,
                        mediaButtonIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                    )
                setMediaButtonReceiver(pendingIntent)

                setCallback(
                    object : MediaSessionCompat.Callback() {
                        override fun onPlay() {
                            handleMediaCommand("play", null)
                        }

                        override fun onPause() {
                            handleMediaCommand("pause", null)
                        }

                        override fun onSkipToNext() {
                            handleMediaCommand("next", null)
                        }

                        override fun onSkipToPrevious() {
                            handleMediaCommand("previous", null)
                        }

                        override fun onSeekTo(pos: Long) {
                            seek(pos / 1000.0)
                        }
                    },
                )
                setPlaybackToLocal(AudioManager.STREAM_MUSIC)
                isActive = true
            }
    }

    private fun handleMediaCommand(
        action: String,
        payload: Map<String, Any>?,
    ) {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("MediaPlaybackService->handleMediaCommand", "action: $action, isRemoteMode: $isRemoteMode")
        }
        if (!isRemoteMode && (action == "next" || action == "previous")) {
            val step = if (action == "next") 1 else -1
            val nextSong = queueManager.advanceSong(step)
            if (nextSong != null) {
                loadAndPlay()
                return
            }
        }
        onCommand?.invoke(action, payload)
    }

    override fun onStartCommand(
        intent: Intent?,
        flags: Int,
        startId: Int,
    ): Int {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("MediaPlaybackService->onStartCommand", "action: ${intent?.action ?: "[null]"}")
        }
        MediaButtonReceiver.handleIntent(mediaSession, intent)
        return START_STICKY
    }

    fun changeTargetPlayer(
        id: Int?,
        name: String?,
    ) {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("MediaPlaybackService->changeTargetPlayer", "id: $id, name: $name")
        }
        targetPlayerId = id
        targetPlayerName = name
        if (targetPlayerId == null) {
            audioPlaybackManager.setMode(false)
            volumeManager.unregisterObserver()
        } else {
            audioPlaybackManager.setMode(true)
            volumeManager.registerObserver()
        }
        serviceScope.launch(Dispatchers.Main) {
            queueManager.loadSession(id, name)
        }
    }

    fun adjustRemoteVolumeByDelta(delta: Double) {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("MediaPlaybackService->adjustRemoteVolumeByDelta", "delta: $delta, isRemoteMode: $isRemoteMode")
        }
        serviceScope.launch(Dispatchers.Main) {
            if (!isRemoteMode) return@launch
            volumeManager.adjustRemoteVolumeByDelta(delta)
        }
    }

    fun syncRemoteVolume(percent: Float) {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("MediaPlaybackService->syncRemoteVolume", "percent: $percent")
        }
        serviceScope.launch(Dispatchers.Main) {
            volumeManager.syncRemoteVolume(percent)
        }
    }

    fun loadAndPlay() {
        serviceScope.launch(Dispatchers.Main) {
            val currentSong = queueManager.currentSong
            if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
                SnowEvents.log("MediaPlaybackService->loadAndPlay", currentSong?.thumbnailWebPath ?: "[empty]")
            }
            audioPlaybackManager.loadAndPlay(currentSong?.webPath ?: "", volumeManager.targetVolume)

            val bitmap = resolveArtworkBitmap(currentSong?.thumbnailWebPath)
            audioPlaybackManager.updateMetadata(
                currentSong?.title,
                currentSong?.artist,
                currentSong?.album,
                currentSong?.duration,
                bitmap,
            )
            audioPlaybackManager.syncSessionPlaybackState(true)
            notificationManager.updateNotification(
                currentSong?.title,
                currentSong?.artist,
                true,
                bitmap,
            )
        }
    }

    fun play(audioFile: AudioFile?) {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("MediaPlaybackService->play", "isRemoteMode: $isRemoteMode")
        }
        serviceScope.launch(Dispatchers.Main) {
            if (audioFile != null) {
                queueManager.addAudioFile(audioFile, playNow = true, playNext = false)
            }

            val currentSong = queueManager.currentSong

            audioPlaybackManager.loadAndPlay(currentSong?.webPath, 1.0f)

            notificationManager.updateNotification(
                currentSong?.title,
                currentSong?.artist,
                true,
                cachedArtworkBitmap,
            )
        }
    }

    fun pause() {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("MediaPlaybackService->pause", "isRemoteMode: $isRemoteMode")
        }
        serviceScope.launch(Dispatchers.Main) {
            if (!isRemoteMode) {
                audioPlaybackManager.pause()
            }
            val currentSong = queueManager.currentSong
            audioPlaybackManager.syncSessionPlaybackState(false)
            notificationManager.updateNotification(
                currentSong?.title,
                currentSong?.artist,
                false,
                cachedArtworkBitmap,
            )
        }
    }

    fun stop() {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("MediaPlaybackService->stop", "Stopping playback")
        }
        serviceScope.launch(Dispatchers.Main) {
            audioPlaybackManager.stop()
            audioPlaybackManager.syncSessionPlaybackState(false)
            notificationManager.stopForegroundNotification()
        }
    }

    fun seek(seconds: Double) {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
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
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
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
            if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
                SnowEvents.log("MediaPlaybackService->resolveArtworkBitmap", "Artwork URL null or empty")
            }
            currentArtworkUrl = null
            cachedArtworkBitmap = null
            return null
        }
        if (artworkUrl == currentArtworkUrl && cachedArtworkBitmap != null) {
            if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
                SnowEvents.log("MediaPlaybackService->resolveArtworkBitmap", "Returning cached bitmap")
            }
            return cachedArtworkBitmap
        }
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
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
            if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
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
            notificationManager.updateNotification(
                currentSong?.title,
                currentSong?.artist,
                true,
                bitmap,
            )
        }
    }

    override fun onDestroy() {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("MediaPlaybackService->onDestroy", "Destroying service")
        }
        progressJob?.cancel()
        volumeManager.cleanup()
        serviceScope.launch(Dispatchers.Main) {
            audioPlaybackManager.cleanup()
        }
        mediaSession.isActive = false
        mediaSession.release()
        ApiClient.cleanup()
        cachedArtworkBitmap = null
        super.onDestroy()
    }
}
