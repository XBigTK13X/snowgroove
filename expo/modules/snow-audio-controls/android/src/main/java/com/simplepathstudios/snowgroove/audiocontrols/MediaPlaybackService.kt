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
    private lateinit var musicSession: MusicSession

    var onStatusUpdate: ((PlayerStatus) -> Unit)? = null
    var onFinished: (() -> Unit)? = null

    private var currentFingerprint: String? = null
    private var currentArtworkUrl: String? = null
    private var cachedArtworkBitmap: Bitmap? = null

    private var progressJob: Job? = null
    private var lastStatus: PlayerStatus? = null

    private val isRemote = targetPlayerId == null

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
                    val currentSong = queueManager.currentSong
                    notificationManager.updateNotification(
                        currentSong?.title,
                        currentSong?.artist,
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
                    } else {
                        SnowEvents.send("playbackComplete")
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
            SnowEvents.log("MediaPlaybackService->handleMediaCommand", "action: $action")
        }
        if (action == "next" || action == "previous") {
            val step = if (action == "next") 1 else -1
            val nextSong = queueManager.advanceSong(step)
            if (nextSong != null) {
                loadAndPlay()
                return
            }
        }
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

    suspend fun loadMusicSession() {
        val session = ApiClient.getMusicSession(targetPlayerId, targetPlayerName)
        if (session == null) {
            if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
                SnowEvents.log("MediaPlaybackService->loadSession", "Failed to retrieve session")
            }
            return
        }

        musicSession = session
        SnowEvents.send("sessionChanged", session.toMap())
        if (targetPlayerId == null) {
            audioPlaybackManager.setSession(null, musicSession)
            volumeManager.unregisterObserver()
        } else {
            audioPlaybackManager.setSession(targetPlayerId, musicSession)
            volumeManager.registerObserver()
        }
        queueManager.setSession(musicSession)
    }

    fun changeTargetPlayer(
        id: Int?,
        name: String?,
    ) {
        serviceScope.launch(Dispatchers.Main) {
            if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
                SnowEvents.log("MediaPlaybackService->changeTargetPlayer", "id: $id, name: $name")
            }
            targetPlayerId = id
            targetPlayerName = name
            loadMusicSession()
        }
    }

    fun loadAndPlay() {
        serviceScope.launch(Dispatchers.Main) {
            val currentSong = queueManager.currentSong
            if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
                SnowEvents.log("MediaPlaybackService->loadAndPlay", currentSong?.thumbnailWebPath ?: "[empty]")
            }

            if (isRemote) {
                queueManager.syncQueue()?.join()
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
            SnowEvents.log("MediaPlaybackService->play", "Playing")
        }
        serviceScope.launch(Dispatchers.Main) {
            if (audioFile != null) {
                queueManager.addAudioFile(audioFile, playNow = true, playNext = false)?.join()
            }

            val currentSong = queueManager.currentSong

            audioPlaybackManager.loadAndPlay(currentSong?.webPath, 1.0)

            notificationManager.updateNotification(
                currentSong?.title,
                currentSong?.artist,
                true,
                cachedArtworkBitmap,
            )

            currentFingerprint = currentSong?.fingerprint ?: null
        }
    }

    fun pause() {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("MediaPlaybackService->pause", "Pausing")
        }
        serviceScope.launch(Dispatchers.Main) {
            audioPlaybackManager.pause()
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

    fun resume() {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("MediaPlaybackService->resume", "Resuming")
        }
        serviceScope.launch(Dispatchers.Main) {
            val currentSong = queueManager.currentSong
            if (currentFingerprint == null || currentFingerprint != currentSong?.fingerprint) {
                play(currentSong)
            } else {
                audioPlaybackManager.resume()
                audioPlaybackManager.syncSessionPlaybackState(false)
                notificationManager.updateNotification(
                    currentSong?.title,
                    currentSong?.artist,
                    false,
                    cachedArtworkBitmap,
                )
            }
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
            SnowEvents.log("MediaPlaybackService->seek", "seconds: $seconds")
        }
        serviceScope.launch(Dispatchers.Main) {
            audioPlaybackManager.seek(seconds)
        }
    }

    fun setVolumeLevel(percent: Double) {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("MediaPlaybackService->setVolumeLevel", "percent: $percent")
        }
        serviceScope.launch(Dispatchers.Main) {
            volumeManager.setLocalVolumeLevel(percent)
            audioPlaybackManager.setVolume(volumeManager.targetVolume)
        }
    }

    fun moveCurrentIndex(amount: Int) {
        queueManager.advanceSong(amount)
        play(queueManager.currentSong)
    }

    fun clearQueue() {
        stop()
        queueManager.clearQueue()
    }

    fun shuffleQueue() {
        stop()
        queueManager.shuffleQueue()
        play(queueManager.currentSong)
    }

    fun addToQueue(audioFiles: List<AudioFile>) {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("MediaPlaybackService->addToQueue", "audioFiles count: ${audioFiles.size}")
        }
        queueManager.addAudioFiles(audioFiles)
    }

    fun removeFromQueue(audioFiles: List<AudioFile>) {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("MediaPlaybackService->removeFromQueue", "audioFiles count: ${audioFiles.size}")
        }
        queueManager.removeAudioFiles(audioFiles)
        if (queueManager.currentSong?.fingerprint != currentFingerprint) {
            stop()
            play(queueManager.currentSong)
        }
    }

    fun moveQueueItem(
        oldIndex: Int,
        newIndex: Int,
    ) {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("MediaPlaybackService->moveQueueItem", "$oldIndex to $newIndex")
        }
        queueManager.move(oldIndex, newIndex)
    }

    private fun startProgressLoop() {
        progressJob?.cancel()
        lastStatus = null
        progressJob =
            serviceScope.launch(Dispatchers.IO) {
                while (isActive) {
                    try {
                        val playerStatus = audioPlaybackManager.getStatus()
                        val currentStatus =
                            PlayerStatus(
                                positionSeconds = (playerStatus.positionSeconds ?: 0L),
                                durationSeconds = (queueManager.currentSong?.duration?.toLong() ?: 0L),
                                isPlaying = (playerStatus.isPlaying ?: false),
                                isLoaded = true,
                                playerState = (playerStatus.playerState ?: "stopped"),
                                queueFingerprint = (playerStatus.queueFingerprint ?: ""),
                                currentSongIndex = (playerStatus.currentSongIndex ?: 0),
                            )
                        if (currentStatus != lastStatus) {
                            if (currentStatus?.currentSongIndex != lastStatus?.currentSongIndex &&
                                currentStatus?.queueFingerprint == lastStatus?.queueFingerprint
                            ) {
                                queueManager.setCurrentIndex(currentStatus?.currentSongIndex ?: 0)
                            }
                            if (currentStatus?.queueFingerprint != lastStatus?.queueFingerprint) {
                                loadMusicSession()
                            }
                            lastStatus = currentStatus
                            withContext(Dispatchers.Main) {
                                onStatusUpdate?.invoke(currentStatus)
                            }
                        }
                    } catch (ignored: Exception) {
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
        lastStatus = null
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
