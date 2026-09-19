package com.simplepathstudios.snowgroove.audiocontrols

import android.app.PendingIntent
import android.app.Service
import android.content.ComponentName
import android.content.Intent
import android.graphics.Bitmap
import android.media.AudioManager
import android.os.Binder
import android.os.IBinder
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.media.session.MediaButtonReceiver
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class SnowgrooveService : Service() {
    inner class LocalBinder : Binder() {
        fun getService(): SnowgrooveService = this@SnowgrooveService
    }

    override fun onBind(intent: Intent?): IBinder = binder

    var onStatusUpdate: ((PlayerStatus) -> Unit)? = null
    var onFinished: (() -> Unit)? = null

    private lateinit var mediaSession: MediaSessionCompat
    private lateinit var notificationManager: PlaybackNotificationManager
    private lateinit var player: Player
    private lateinit var volumeManager: VolumeManager
    private lateinit var queueManager: QueueManager
    private lateinit var musicSession: MusicSession

    private var targetPlayerId: Int? = null
    private var targetPlayerName: String? = null
    private var currentFingerprint: String? = null
    private var currentArtworkUrl: String? = null
    private var cachedArtworkBitmap: Bitmap? = null

    private var progressJob: Job? = null
    private var currentStatus: PlayerStatus? = null
    private var lastStatus: PlayerStatus? = null

    private val binder = LocalBinder()
    private val serviceScope = CoroutineScope(Dispatchers.Main + Job())

    private val isRemote: Boolean
        get() = targetPlayerId != null

    override fun onCreate() {
        super.onCreate()

        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("SnowgrooveService->onCreate", "Initializing service")
        }

        initMediaSession()

        notificationManager = PlaybackNotificationManager(this, mediaSession)

        queueManager = QueueManager()

        player =
            Player(
                context = this,
                onItemFinished = {
                    if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
                        SnowEvents.log("SnowgrooveService->onItemFinished", "Current track finished")
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

    override fun onStartCommand(
        intent: Intent?,
        flags: Int,
        startId: Int,
    ): Int {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("SnowgrooveService->onStartCommand", "action: ${intent?.action ?: "[null]"}")
        }
        MediaButtonReceiver.handleIntent(mediaSession, intent)
        return START_STICKY
    }

    // Android notification handlers
    private fun handleMediaCommand(
        action: String,
        payload: Map<String, Any>?,
    ) {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("SnowgrooveService->handleMediaCommand", "action: $action")
        }
        if (action == "next" || action == "previous") {
            val step = if (action == "next") 1 else -1
            val nextSong = queueManager.advanceSong(step)
            if (nextSong != null) {
                currentStatus?.positionSeconds = 0L
                loadAndPlay()
                return
            }
        }
        if (action == "play") {
            player.resume()
        }
        if (action == "pause") {
            player.pause()
        }
    }

    // Used by the notification and other system controls
    private fun initMediaSession() {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("SnowgrooveService->initMediaSession", "Initializing MediaSessionCompat")
        }
        val mediaButtonReceiver = ComponentName(this, MediaButtonReceiver::class.java)
        mediaSession =
            MediaSessionCompat(this, "SnowgrooveSession", mediaButtonReceiver, null).apply {
                val mediaButtonIntent =
                    Intent(Intent.ACTION_MEDIA_BUTTON).apply {
                        setClass(this@SnowgrooveService, MediaButtonReceiver::class.java)
                    }
                val pendingIntent =
                    PendingIntent.getBroadcast(
                        this@SnowgrooveService,
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

    suspend fun loadMusicSession() {
        val session = ApiClient.getMusicSession(targetPlayerId, targetPlayerName)
        if (session == null) {
            if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
                SnowEvents.log("SnowgrooveService->loadSession", "Failed to retrieve session")
            }
            return
        }

        musicSession = session
        SnowEvents.send("sessionChanged", session.toMap())
        volumeManager.unregisterObserver()
        if (targetPlayerId == null) {
            player.setSession(null, musicSession)
        } else {
            player.setSession(targetPlayerId, musicSession)
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
                SnowEvents.log("SnowgrooveService->changeTargetPlayer", "id: $id, name: $name")
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
                SnowEvents.log("SnowgrooveService->loadAndPlay", currentSong?.webPath ?: "[empty]")
            }

            if (isRemote) {
                queueManager.syncQueue()?.join()
            }

            player.loadAndPlay(currentSong?.webPath ?: "")

            updateMediaSession()
        }
    }

    fun play(audioFile: AudioFile?) {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("SnowgrooveService->play", "Playing")
        }
        serviceScope.launch(Dispatchers.Main) {
            if (audioFile != null) {
                queueManager.addAudioFile(audioFile, playNow = true, playNext = false)?.join()
            }
            val currentSong = queueManager.currentSong
            player.loadAndPlay(currentSong?.webPath)
            updateMediaSession()
            currentFingerprint = currentSong?.fingerprint ?: null
        }
    }

    fun pause() {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("SnowgrooveService->pause", "Pausing")
        }
        serviceScope.launch(Dispatchers.Main) {
            player.pause()
            updateMediaSession()
        }
    }

    fun resume() {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("SnowgrooveService->resume", "Resuming")
        }
        serviceScope.launch(Dispatchers.Main) {
            val currentSong = queueManager.currentSong
            if (currentFingerprint == null || currentFingerprint != currentSong?.fingerprint) {
                play(currentSong)
            } else {
                player.resume()
            }
            updateMediaSession()
        }
    }

    fun stop() {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("SnowgrooveService->stop", "Stopping playback")
        }
        serviceScope.launch(Dispatchers.Main) {
            player.stop()
            updateMediaSession()
        }
    }

    fun seek(seconds: Double) {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("SnowgrooveService->seek", "seconds: $seconds")
        }
        serviceScope.launch(Dispatchers.Main) {
            player.seek(seconds)
            // Force the status to reflect the desired seek,
            // Otherwise the notification position bounces around
            currentStatus?.positionSeconds = seconds.toLong()
            updateMediaSession()
        }
    }

    fun setVolumeLevel(percent: Double) {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("SnowgrooveService->setVolumeLevel", "percent: $percent")
        }
        serviceScope.launch(Dispatchers.Main) {
            player.setVolume(percent)
            volumeManager.setVolume(percent)
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
            SnowEvents.log("SnowgrooveService->addToQueue", "audioFiles count: ${audioFiles.size}")
        }
        queueManager.addAudioFiles(audioFiles)
    }

    fun removeFromQueue(audioFiles: List<AudioFile>) {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("SnowgrooveService->removeFromQueue", "audioFiles count: ${audioFiles.size}")
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
            SnowEvents.log("SnowgrooveService->moveQueueItem", "$oldIndex to $newIndex")
        }
        queueManager.move(oldIndex, newIndex)
    }

    fun playNext(audioFile: AudioFile) {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("SnowgrooveService->playNext", "${audioFile.fingerprint}")
        }
        queueManager.playNext(audioFile)
    }

    private fun startProgressLoop() {
        progressJob?.cancel()
        lastStatus = null
        progressJob =
            serviceScope.launch(Dispatchers.IO) {
                while (isActive) {
                    try {
                        player.getStatus()?.let { playerStatus ->
                            val computedStatus =
                                PlayerStatus(
                                    positionSeconds = (playerStatus.positionSeconds ?: 0L),
                                    durationSeconds = (queueManager.currentSong?.duration?.toLong() ?: 0L),
                                    isPlaying = (playerStatus.isPlaying ?: false),
                                    isLoaded = true,
                                    playerState = (playerStatus.playerState ?: "stopped"),
                                    queueFingerprint = (playerStatus.queueFingerprint ?: ""),
                                    currentSongIndex = (playerStatus.currentSongIndex ?: 0),
                                    volume = (playerStatus.volume ?: 0.0),
                                )
                            // Without this, onStatusUpdate freaks out about nullable types
                            currentStatus = computedStatus
                            if (currentStatus != lastStatus) {
                                // TODO Maybe instead of this, have the volumeManager poll the remote device on button press?
                                volumeManager.setInitialVolume(musicSession.id, playerStatus.volume)
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
                                    onStatusUpdate?.invoke(computedStatus)
                                    updateMediaSession()
                                }
                            }
                        }
                    } catch (exception: Exception) {
                        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
                            SnowEvents.error(
                                "SnowgrooveService->startProgressLoop",
                                "Exception in the progress loop",
                                exception,
                            )
                        }
                    }
                    delay(SnowConfig.REMOTE_POLLING_DELAY_MILLISECONDS)
                }
            }
    }

    private suspend fun resolveArtworkBitmap(artworkUrl: String?): Bitmap? {
        if (artworkUrl.isNullOrEmpty()) {
            if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
                SnowEvents.log("SnowgrooveService->resolveArtworkBitmap", "Artwork URL null or empty")
            }
            currentArtworkUrl = null
            cachedArtworkBitmap = null
            return null
        }
        if (artworkUrl == currentArtworkUrl && cachedArtworkBitmap != null) {
            if (SnowConfig.DEBUG_ANDROID_AUDIO == "verbose") {
                SnowEvents.log("SnowgrooveService->resolveArtworkBitmap", "Returning cached bitmap")
            }
            return cachedArtworkBitmap
        }
        if (SnowConfig.DEBUG_ANDROID_AUDIO == "verbose") {
            SnowEvents.log("SnowgrooveService->resolveArtworkBitmap", "Fetching bitmap: $artworkUrl")
        }
        val downloaded = ApiClient.fetchBitmap(artworkUrl)
        currentArtworkUrl = artworkUrl
        cachedArtworkBitmap = downloaded
        return downloaded
    }

    suspend fun updateMediaSession() {
        if (queueManager.currentSong == null) {
            return
        }
        val currentSong = queueManager.currentSong
        val isPlaying = currentStatus?.isPlaying ?: false
        val positionSeconds = currentStatus?.positionSeconds ?: 0
        if (SnowConfig.DEBUG_ANDROID_AUDIO == "verbose") {
            SnowEvents.log(
                "SnowgrooveService->updateMediaSession",
                "title: ${currentSong?.title} - ${currentSong?.artist}",
            )
        }
        val coverArt = resolveArtworkBitmap(currentSong?.thumbnailWebPath)
        val durationMilliseconds = ((currentSong?.duration ?: 0.0) * 1000.0).toLong()
        val metadata =
            MediaMetadataCompat
                .Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, currentSong?.title)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, currentSong?.artist)
                .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, currentSong?.album)
                .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, durationMilliseconds)
                .apply {
                    if (coverArt != null) {
                        putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, coverArt)
                        putBitmap(MediaMetadataCompat.METADATA_KEY_ART, coverArt)
                    }
                }.build()

        val stateCode = if (isPlaying ?: false) PlaybackStateCompat.STATE_PLAYING else PlaybackStateCompat.STATE_PAUSED
        val actions =
            PlaybackStateCompat.ACTION_PLAY or
                PlaybackStateCompat.ACTION_PAUSE or
                PlaybackStateCompat.ACTION_PLAY_PAUSE or
                PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
                PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS or
                PlaybackStateCompat.ACTION_SEEK_TO

        val playbackState =
            PlaybackStateCompat
                .Builder()
                .setState(stateCode, positionSeconds.toLong() * 1000L, if (isPlaying) 1.0f else 0.0f)
                .setActions(actions)
                .build()

        mediaSession.setMetadata(metadata)
        mediaSession.setPlaybackState(playbackState)

        notificationManager.updateNotification(
            currentSong?.title,
            currentSong?.artist,
            isPlaying,
            coverArt,
        )
    }

    override fun onDestroy() {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("SnowgrooveService->onDestroy", "Destroying service")
        }
        progressJob?.cancel()
        lastStatus = null
        volumeManager.cleanup()
        serviceScope.launch(Dispatchers.Main) {
            player.cleanup()
        }
        mediaSession.isActive = false
        mediaSession.release()
        ApiClient.cleanup()
        cachedArtworkBitmap = null
        super.onDestroy()
    }
}
