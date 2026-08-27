package com.simplepathstudios.snowgroove.audiocontrols

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Binder
import android.os.Build
import android.os.IBinder
import android.os.Looper
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.core.app.NotificationCompat
import androidx.media.VolumeProviderCompat
import androidx.media.app.NotificationCompat.MediaStyle
import androidx.media.session.MediaButtonReceiver
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.ExoPlayer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL

class MediaPlaybackService : Service() {
    private val binder = LocalBinder()
    private val notificationChannelId = "snowgroove_playback_channel"
    private val notificationId = 9914
    private val serviceScope = CoroutineScope(Dispatchers.Main + Job())

    private var exoPlayer: ExoPlayer? = null
    var mediaSession: MediaSessionCompat? = null
    var onCommand: ((String, Map<String, Any>?) -> Unit)? = null
    var onStatusUpdate: ((Map<String, Any>) -> Unit)? = null
    var onFinished: (() -> Unit)? = null

    private var currentTitle = ""
    private var currentArtist = ""
    private var currentAlbum = ""
    private var currentArtworkUrl: String? = null
    private var cachedArtworkBitmap: Bitmap? = null
    private var targetVolume = 1.0f
    private var remoteVolumeLevel = 100
    private var hasFiredFinishedForCurrentItem = false

    private var progressJob: Job? = null

    inner class LocalBinder : Binder() {
        fun getService(): MediaPlaybackService = this@MediaPlaybackService
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()

        mediaSession = MediaSessionCompat(this, "SnowgrooveSession").apply {
            setFlags(
                MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS or
                MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
            )
            isActive = true
            setCallback(object : MediaSessionCompat.Callback() {
                override fun onPlay() { onCommand?.invoke("play", null) }
                override fun onPause() { onCommand?.invoke("pause", null) }
                override fun onSkipToNext() { onCommand?.invoke("next", null) }
                override fun onSkipToPrevious() { onCommand?.invoke("previous", null) }
                override fun onSeekTo(pos: Long) {
                    seek(pos / 1000.0)
                }
            })
        }

        val initialNotification = buildNotification(mediaSession!!, "Snowgroove", "Ready", false, null)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(notificationId, initialNotification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
            } else {
                startForeground(notificationId, initialNotification)
            }
        } catch (ignored: Exception) {}

        startProgressLoop()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        MediaButtonReceiver.handleIntent(mediaSession, intent)
        return START_STICKY
    }

    private fun initExoPlayer() {
        if (exoPlayer == null) {
            val loadControl = DefaultLoadControl.Builder()
                .setBufferDurationsMs(
                    30000,
                    60000,
                    2500,
                    5000
                )
                .build()

            val audioAttributes = AudioAttributes.Builder()
                .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                .setUsage(C.USAGE_MEDIA)
                .build()

            exoPlayer = ExoPlayer.Builder(applicationContext)
                .setLooper(Looper.getMainLooper())
                .setLoadControl(loadControl)
                .setAudioAttributes(audioAttributes, true)
                .setHandleAudioBecomingNoisy(true)
                .setWakeMode(C.WAKE_MODE_LOCAL)
                .build()
                .apply {
                    volume = targetVolume
                    addListener(object : Player.Listener {
                        override fun onPlaybackStateChanged(playbackState: Int) {
                            when (playbackState) {
                                Player.STATE_ENDED -> {
                                    updatePlaybackState(false)
                                    if (!hasFiredFinishedForCurrentItem) {
                                        hasFiredFinishedForCurrentItem = true
                                        onFinished?.invoke()
                                    }
                                }
                                Player.STATE_READY -> {
                                    updatePlaybackState(playWhenReady)
                                }
                                Player.STATE_BUFFERING -> {
                                    updatePlaybackState(playWhenReady)
                                }
                                Player.STATE_IDLE -> {
                                    updatePlaybackState(false)
                                }
                            }
                        }

                        override fun onIsPlayingChanged(isPlaying: Boolean) {
                            updatePlaybackState(isPlaying)
                            updateNotification(isPlaying, cachedArtworkBitmap)
                        }

                        override fun onPlayerError(error: PlaybackException) {
                            updatePlaybackState(false)
                        }
                    })
                }
        }
    }

    fun setRemoteControlMode(enabled: Boolean, initialVolumePercent: Float) {
        serviceScope.launch(Dispatchers.Main) {
            val session = mediaSession ?: return@launch
            if (enabled) {
                remoteVolumeLevel = (initialVolumePercent.coerceIn(0.0f, 1.0f) * 100).toInt()
                val volumeProvider = object : VolumeProviderCompat(
                    VolumeProviderCompat.VOLUME_CONTROL_RELATIVE,
                    100,
                    remoteVolumeLevel
                ) {
                    override fun onAdjustVolume(direction: Int) {
                        val delta = when (direction) {
                            1 -> 5
                            -1 -> -5
                            else -> 0
                        }
                        if (delta != 0) {
                            remoteVolumeLevel = (remoteVolumeLevel + delta).coerceIn(0, 100)
                            currentVolume = remoteVolumeLevel
                            onCommand?.invoke("volumeAdjust", mapOf("percent" to (remoteVolumeLevel / 100.0)))
                        }
                    }

                    override fun onSetVolumeTo(volume: Int) {
                        remoteVolumeLevel = volume.coerceIn(0, 100)
                        currentVolume = remoteVolumeLevel
                        onCommand?.invoke("volumeAdjust", mapOf("percent" to (remoteVolumeLevel / 100.0)))
                    }
                }
                session.setPlaybackToRemote(volumeProvider)
            } else {
                session.setPlaybackToLocal(android.media.AudioManager.STREAM_MUSIC)
            }
        }
    }

    fun syncRemoteVolume(percent: Float) {
        serviceScope.launch(Dispatchers.Main) {
            remoteVolumeLevel = (percent.coerceIn(0.0f, 1.0f) * 100).toInt()
        }
    }

    fun loadAndPlay(uri: String, title: String, artist: String, album: String, artworkUrl: String?, duration: Long) {
        currentTitle = title
        currentArtist = artist
        currentAlbum = album
        hasFiredFinishedForCurrentItem = false

        serviceScope.launch(Dispatchers.Main) {
            setRemoteControlMode(false, targetVolume)
            initExoPlayer()

            exoPlayer?.let { player ->
                player.stop()
                player.clearMediaItems()
                val mediaItem = MediaItem.fromUri(uri)
                player.setMediaItem(mediaItem)
                player.prepare()
                player.playWhenReady = true
            }

            val bitmap = if (!artworkUrl.isNullOrEmpty()) {
                if (artworkUrl == currentArtworkUrl && cachedArtworkBitmap != null) {
                    cachedArtworkBitmap
                } else {
                    val downloaded = withContext(Dispatchers.IO) { fetchBitmap(artworkUrl) }
                    currentArtworkUrl = artworkUrl
                    cachedArtworkBitmap = downloaded
                    downloaded
                }
            } else {
                currentArtworkUrl = null
                cachedArtworkBitmap = null
                null
            }

            val metadata = MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, currentTitle)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, currentArtist)
                .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, currentAlbum)
                .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, duration * 1000L)
                .apply {
                    if (bitmap != null) {
                        putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, bitmap)
                        putBitmap(MediaMetadataCompat.METADATA_KEY_ART, bitmap)
                    }
                }
                .build()

            mediaSession?.setMetadata(metadata)
            updatePlaybackState(true)
            updateNotification(true, bitmap)
        }
    }

    fun play() {
        serviceScope.launch(Dispatchers.Main) {
            exoPlayer?.let { player ->
                player.playWhenReady = true
                updatePlaybackState(true)
                updateNotification(true, cachedArtworkBitmap)
            }
        }
    }

    fun pause() {
        serviceScope.launch(Dispatchers.Main) {
            exoPlayer?.let { player ->
                player.playWhenReady = false
                updatePlaybackState(false)
                updateNotification(false, cachedArtworkBitmap)
            }
        }
    }

    fun stop() {
        serviceScope.launch(Dispatchers.Main) {
            exoPlayer?.let { player ->
                try {
                    player.stop()
                    player.clearMediaItems()
                } catch (ignored: Exception) {}
            }
            updatePlaybackState(false)
            stopForegroundNotification()
        }
    }

    fun seek(seconds: Double) {
        serviceScope.launch(Dispatchers.Main) {
            val targetMillis = (seconds * 1000).toLong()
            exoPlayer?.seekTo(targetMillis)
            updatePlaybackState(exoPlayer?.isPlaying == true)
        }
    }

    fun setVolumeLevel(percent: Float) {
        serviceScope.launch(Dispatchers.Main) {
            targetVolume = percent.coerceIn(0.0f, 1.0f)
            exoPlayer?.volume = targetVolume
        }
    }

    private fun updatePlaybackState(isPlaying: Boolean) {
        val session = mediaSession ?: return
        val currentPosition = exoPlayer?.currentPosition ?: 0L
        val stateCode = if (isPlaying) PlaybackStateCompat.STATE_PLAYING else PlaybackStateCompat.STATE_PAUSED
        val actions = PlaybackStateCompat.ACTION_PLAY or
                PlaybackStateCompat.ACTION_PAUSE or
                PlaybackStateCompat.ACTION_PLAY_PAUSE or
                PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
                PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS or
                PlaybackStateCompat.ACTION_SEEK_TO

        val playbackState = PlaybackStateCompat.Builder()
            .setState(stateCode, currentPosition, 1.0f)
            .setActions(actions)
            .build()

        session.setPlaybackState(playbackState)
    }

    private fun startProgressLoop() {
        progressJob?.cancel()
        progressJob = serviceScope.launch(Dispatchers.Default) {
            while (isActive) {
                val player = exoPlayer
                if (player != null) {
                    try {
                        withContext(Dispatchers.Main) {
                            if (player.playbackState == Player.STATE_READY || player.playbackState == Player.STATE_BUFFERING) {
                                val currentPosition = player.currentPosition
                                val duration = player.duration.coerceAtLeast(0L)
                                onStatusUpdate?.invoke(
                                    mapOf(
                                        "positionMillis" to currentPosition,
                                        "durationMillis" to duration,
                                        "isPlaying" to player.isPlaying,
                                        "isLoaded" to true
                                    )
                                )
                            }
                        }
                    } catch (ignored: Exception) {}
                }
                delay(1000)
            }
        }
    }

    private fun updateNotification(isPlaying: Boolean, artwork: Bitmap?) {
        val session = mediaSession ?: return
        val notification = buildNotification(session, currentTitle, currentArtist, isPlaying, artwork)

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(notificationId, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
            } else {
                startForeground(notificationId, notification)
            }
        } catch (ignored: Exception) {}
    }

    private fun stopForegroundNotification() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE)
            } else {
                @Suppress("DEPRECATION")
                stopForeground(true)
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.cancel(notificationId)
        } catch (ignored: Exception) {}
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                notificationChannelId,
                "Snowgroove Playback",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Media controls and audio playback"
                setShowBadge(false)
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(
        session: MediaSessionCompat,
        title: String,
        artist: String,
        isPlaying: Boolean,
        artwork: Bitmap?
    ): Notification {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val contentPendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val smallIconResId = resources.getIdentifier("ic_launcher", "mipmap", packageName).let {
            if (it != 0) it else android.R.drawable.ic_media_play
        }

        val playPauseAction = if (isPlaying) {
            NotificationCompat.Action(
                android.R.drawable.ic_media_pause,
                "Pause",
                MediaButtonReceiver.buildMediaButtonPendingIntent(this, PlaybackStateCompat.ACTION_PAUSE)
            )
        } else {
            NotificationCompat.Action(
                android.R.drawable.ic_media_play,
                "Play",
                MediaButtonReceiver.buildMediaButtonPendingIntent(this, PlaybackStateCompat.ACTION_PLAY)
            )
        }

        val prevAction = NotificationCompat.Action(
            android.R.drawable.ic_media_previous,
            "Previous",
            MediaButtonReceiver.buildMediaButtonPendingIntent(this, PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS)
        )

        val nextAction = NotificationCompat.Action(
            android.R.drawable.ic_media_next,
            "Next",
            MediaButtonReceiver.buildMediaButtonPendingIntent(this, PlaybackStateCompat.ACTION_SKIP_TO_NEXT)
        )

        val builder = NotificationCompat.Builder(this, notificationChannelId)
            .setSmallIcon(smallIconResId)
            .setContentTitle(title.ifEmpty { "Snowgroove" })
            .setContentText(artist)
            .setContentIntent(contentPendingIntent)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(isPlaying)
            .addAction(prevAction)
            .addAction(playPauseAction)
            .addAction(nextAction)
            .setStyle(
                MediaStyle()
                    .setMediaSession(session.sessionToken)
                    .setShowActionsInCompactView(0, 1, 2)
            )

        if (artwork != null) {
            builder.setLargeIcon(artwork)
        }

        return builder.build()
    }

    private fun fetchBitmap(src: String): Bitmap? {
        var connection: HttpURLConnection? = null
        var inputStream: InputStream? = null
        return try {
            val url = URL(src)
            connection = (url.openConnection() as HttpURLConnection).apply {
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
        } catch (e: Exception) {
            null
        } finally {
            try { inputStream?.close() } catch (ignored: Exception) {}
            try { connection?.disconnect() } catch (ignored: Exception) {}
        }
    }

    fun updateRemoteMetadata(title: String, artist: String, album: String, artworkUrl: String?, duration: Long, isPlaying: Boolean) {
        currentTitle = title
        currentArtist = artist
        currentAlbum = album

        serviceScope.launch(Dispatchers.Main) {
            val bitmap = if (!artworkUrl.isNullOrEmpty()) {
                if (artworkUrl == currentArtworkUrl && cachedArtworkBitmap != null) {
                    cachedArtworkBitmap
                } else {
                    val downloaded = withContext(Dispatchers.IO) { fetchBitmap(artworkUrl) }
                    currentArtworkUrl = artworkUrl
                    cachedArtworkBitmap = downloaded
                    downloaded
                }
            } else {
                currentArtworkUrl = null
                cachedArtworkBitmap = null
                null
            }

            val metadata = MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, currentTitle)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, currentArtist)
                .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, currentAlbum)
                .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, duration * 1000L)
                .apply {
                    if (bitmap != null) {
                        putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, bitmap)
                        putBitmap(MediaMetadataCompat.METADATA_KEY_ART, bitmap)
                    }
                }
                .build()

            mediaSession?.setMetadata(metadata)
            updatePlaybackState(isPlaying)
            updateNotification(isPlaying, bitmap)
        }
    }

    override fun onDestroy() {
        progressJob?.cancel()
        serviceScope.launch(Dispatchers.Main) {
            exoPlayer?.release()
            exoPlayer = null
        }
        mediaSession?.isActive = false
        mediaSession?.release()
        mediaSession = null
        cachedArtworkBitmap = null
        super.onDestroy()
    }
}