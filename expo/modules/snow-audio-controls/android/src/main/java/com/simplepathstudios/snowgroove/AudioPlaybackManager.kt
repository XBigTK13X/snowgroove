package com.simplepathstudios.snowgroove.audiocontrols

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.media.AudioManager
import android.os.Looper
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.media.session.MediaButtonReceiver
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.ExoPlayer

class AudioPlaybackManager(
    private val context: Context,
    private val onPlaybackStateChange: (isPlaying: Boolean) -> Unit,
    private val onItemFinished: () -> Unit,
    private val onCommandAction: (String, Map<String, Any>?) -> Unit,
    private val onSeekAction: (Double) -> Unit,
) {
    var mediaSession: MediaSessionCompat? = null
        private set

    private var exoPlayer: ExoPlayer? = null
    private var hasFiredFinishedForCurrentItem = false

    init {
        initMediaSession()
    }

    private fun initMediaSession() {
        val mediaButtonReceiver = ComponentName(context, MediaButtonReceiver::class.java)
        mediaSession =
            MediaSessionCompat(context, "SnowgrooveSession", mediaButtonReceiver, null).apply {
                setFlags(
                    MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS or
                        MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS,
                )

                val mediaButtonIntent =
                    Intent(Intent.ACTION_MEDIA_BUTTON).apply {
                        setClass(context, MediaButtonReceiver::class.java)
                    }
                val pendingIntent =
                    android.app.PendingIntent.getBroadcast(
                        context,
                        0,
                        mediaButtonIntent,
                        android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE,
                    )
                setMediaButtonReceiver(pendingIntent)

                setCallback(
                    object : MediaSessionCompat.Callback() {
                        override fun onPlay() {
                            onCommandAction("play", null)
                        }

                        override fun onPause() {
                            onCommandAction("pause", null)
                        }

                        override fun onSkipToNext() {
                            onCommandAction("next", null)
                        }

                        override fun onSkipToPrevious() {
                            onCommandAction("previous", null)
                        }

                        override fun onSeekTo(pos: Long) {
                            onSeekAction(pos / 1000.0)
                        }
                    },
                )
                setPlaybackToLocal(AudioManager.STREAM_MUSIC)
                isActive = true
            }
    }

    fun ensurePlayer(
        targetVolume: Float,
        isRemoteMode: Boolean,
    ) {
        if (exoPlayer == null) {
            val loadControl =
                DefaultLoadControl
                    .Builder()
                    .setBufferDurationsMs(
                        30000,
                        60000,
                        2500,
                        5000,
                    ).build()

            val audioAttributes =
                AudioAttributes
                    .Builder()
                    .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                    .setUsage(C.USAGE_MEDIA)
                    .build()

            exoPlayer =
                ExoPlayer
                    .Builder(context.applicationContext)
                    .setLooper(Looper.getMainLooper())
                    .setLoadControl(loadControl)
                    .setAudioAttributes(audioAttributes, true)
                    .setHandleAudioBecomingNoisy(true)
                    .setWakeMode(C.WAKE_MODE_LOCAL)
                    .build()
                    .apply {
                        volume = targetVolume
                        addListener(
                            object : Player.Listener {
                                override fun onPlaybackStateChanged(playbackState: Int) {
                                    if (isRemoteMode) return
                                    when (playbackState) {
                                        Player.STATE_ENDED -> {
                                            updatePlaybackState(false, isRemoteMode)
                                            if (!hasFiredFinishedForCurrentItem) {
                                                hasFiredFinishedForCurrentItem = true
                                                onItemFinished()
                                            }
                                        }

                                        Player.STATE_READY -> {
                                            hasFiredFinishedForCurrentItem = false
                                            updatePlaybackState(playWhenReady, isRemoteMode)
                                        }

                                        Player.STATE_BUFFERING -> {
                                            updatePlaybackState(playWhenReady, isRemoteMode)
                                        }

                                        Player.STATE_IDLE -> {
                                            updatePlaybackState(false, isRemoteMode)
                                        }
                                    }
                                }

                                override fun onIsPlayingChanged(isPlaying: Boolean) {
                                    if (!isRemoteMode) {
                                        updatePlaybackState(isPlaying, isRemoteMode)
                                        onPlaybackStateChange(isPlaying)
                                    }
                                }

                                override fun onPlayerError(error: PlaybackException) {
                                    if (!isRemoteMode) {
                                        updatePlaybackState(false, isRemoteMode)
                                    }
                                }
                            },
                        )
                    }
        } else {
            if (!isRemoteMode) {
                exoPlayer?.volume = targetVolume
            }
        }
    }

    fun loadAndPlay(
        uri: String,
        targetVolume: Float,
    ) {
        hasFiredFinishedForCurrentItem = false
        ensurePlayer(targetVolume, false)
        exoPlayer?.let { player ->
            player.repeatMode = Player.REPEAT_MODE_OFF
            player.volume = targetVolume
            player.stop()
            player.clearMediaItems()
            val mediaItem = MediaItem.fromUri(uri)
            player.setMediaItem(mediaItem)
            player.prepare()
            player.playWhenReady = true
        }
    }

    fun play(targetVolume: Float) {
        exoPlayer?.let { player ->
            player.volume = targetVolume
            player.playWhenReady = true
        }
    }

    fun pause() {
        exoPlayer?.playWhenReady = false
    }

    fun stop() {
        exoPlayer?.let { player ->
            try {
                player.stop()
                player.clearMediaItems()
            } catch (ignored: Exception) {
            }
        }
    }

    fun seekLocal(targetMillis: Long) {
        exoPlayer?.seekTo(targetMillis)
    }

    fun setLocalVolume(volume: Float) {
        exoPlayer?.volume = volume
    }

    fun isLocalPlaying(): Boolean = exoPlayer?.isPlaying == true

    fun getPlayerProgress(): Pair<Long, Long>? {
        val player = exoPlayer ?: return null
        if (player.playbackState == Player.STATE_READY || player.playbackState == Player.STATE_BUFFERING) {
            val currentPosition = player.currentPosition
            val duration = player.duration.coerceAtLeast(0L)
            return Pair(currentPosition, duration)
        }
        return null
    }

    fun updateMetadata(
        title: String,
        artist: String,
        album: String,
        durationSeconds: Long,
        artwork: Bitmap?,
    ) {
        val metadata =
            MediaMetadataCompat
                .Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, artist)
                .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, album)
                .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, durationSeconds * 1000L)
                .apply {
                    if (artwork != null) {
                        putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, artwork)
                        putBitmap(MediaMetadataCompat.METADATA_KEY_ART, artwork)
                    }
                }.build()

        mediaSession?.setMetadata(metadata)
    }

    fun updatePlaybackState(
        isPlaying: Boolean,
        isRemoteMode: Boolean,
        explicitPositionMillis: Long? = null,
    ) {
        val session = mediaSession ?: return
        val currentPosition =
            explicitPositionMillis ?: if (isRemoteMode) {
                (session.controller.playbackState?.position ?: 0L)
            } else {
                (exoPlayer?.currentPosition ?: 0L)
            }

        val stateCode = if (isPlaying) PlaybackStateCompat.STATE_PLAYING else PlaybackStateCompat.STATE_PAUSED
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
                .setState(stateCode, currentPosition, if (isPlaying) 1.0f else 0.0f)
                .setActions(actions)
                .build()

        session.setPlaybackState(playbackState)
    }

    fun release() {
        exoPlayer?.release()
        exoPlayer = null
        mediaSession?.isActive = false
        mediaSession?.release()
        mediaSession = null
    }
}
