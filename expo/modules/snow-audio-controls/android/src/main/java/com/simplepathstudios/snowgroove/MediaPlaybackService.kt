package com.simplepathstudios.snowgroove

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
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.os.Binder
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.core.app.NotificationCompat
import androidx.media.app.NotificationCompat.MediaStyle
import androidx.media.session.MediaButtonReceiver
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

    private var mediaPlayer: MediaPlayer? = null
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

    private fun initMediaPlayer() {
        if (mediaPlayer == null) {
            mediaPlayer = MediaPlayer().apply {
                setWakeMode(applicationContext, PowerManager.PARTIAL_WAKE_LOCK)
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .build()
                )
                setOnCompletionListener {
                    updatePlaybackState(false)
                    onFinished?.invoke()
                }
                setOnPreparedListener {
                    setVolume(targetVolume, targetVolume)
                    it.start()
                    updatePlaybackState(true)
                }
                setOnErrorListener { _, _, _ ->
                    updatePlaybackState(false)
                    true
                }
            }
        }
    }

    fun loadAndPlay(uri: String, title: String, artist: String, album: String, artworkUrl: String?, duration: Long) {
        currentTitle = title
        currentArtist = artist
        currentAlbum = album

        initMediaPlayer()

        try {
            mediaPlayer?.reset()
            mediaPlayer?.setDataSource(uri)
            mediaPlayer?.prepareAsync()
        } catch (error: Exception) {
            return
        }

        serviceScope.launch {
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
            updateNotification(true, bitmap)
        }
    }

    fun play() {
        mediaPlayer?.let {
            if (!it.isPlaying) {
                it.start()
                updatePlaybackState(true)
                updateNotification(true, cachedArtworkBitmap)
            }
        }
    }

    fun pause() {
        mediaPlayer?.let {
            if (it.isPlaying) {
                it.pause()
                updatePlaybackState(false)
                updateNotification(false, cachedArtworkBitmap)
            }
        }
    }

    fun stop() {
        mediaPlayer?.let {
            try {
                if (it.isPlaying) {
                    it.stop()
                }
                it.reset()
            } catch (ignored: Exception) {}
        }
        updatePlaybackState(false)
        stopForegroundNotification()
    }

    fun seek(seconds: Double) {
        val targetMillis = (seconds * 1000).toInt()
        mediaPlayer?.seekTo(targetMillis)
        updatePlaybackState(mediaPlayer?.isPlaying == true)
    }

    fun setVolumeLevel(percent: Float) {
        targetVolume = percent.coerceIn(0.0f, 1.0f)
        mediaPlayer?.setVolume(targetVolume, targetVolume)
    }

    private fun updatePlaybackState(isPlaying: Boolean) {
        val session = mediaSession ?: return
        val currentPosition = mediaPlayer?.currentPosition?.toLong() ?: 0L
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
                val player = mediaPlayer
                if (player != null) {
                    try {
                        if (player.isPlaying) {
                            val currentPosition = player.currentPosition
                            val duration = player.duration
                            onStatusUpdate?.invoke(
                                mapOf(
                                    "positionMillis" to currentPosition,
                                    "durationMillis" to duration,
                                    "isPlaying" to true,
                                    "isLoaded" to true
                                )
                            )
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
            if (isPlaying) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    startForeground(notificationId, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
                } else {
                    startForeground(notificationId, notification)
                }
            } else {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    stopForeground(STOP_FOREGROUND_DETACH)
                } else {
                    @Suppress("DEPRECATION")
                    stopForeground(false)
                }
                val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                manager.notify(notificationId, notification)
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

        serviceScope.launch {
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
        mediaPlayer?.release()
        mediaPlayer = null
        mediaSession?.isActive = false
        mediaSession?.release()
        mediaSession = null
        cachedArtworkBitmap = null
        super.onDestroy()
    }
}