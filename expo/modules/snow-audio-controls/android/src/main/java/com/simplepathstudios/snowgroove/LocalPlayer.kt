package com.simplepathstudios.snowgroove.audiocontrols

import android.content.Context
import android.os.Looper
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.ExoPlayer


class LocalPlayer(
    private val context: Context,
    private val onPlaybackStateChange: (isPlaying: Boolean) -> Unit,
    private val onItemFinished: () -> Unit,
    private val onInternalStateUpdate: (isPlaying: Boolean, positionMillis: Long) -> Unit,
) : ISnowPlayer {
    private var exoPlayer: ExoPlayer? = null
    private var hasFiredFinishedForCurrentItem = false

    override val isPlaying: Boolean
        get() = exoPlayer?.isPlaying == true

    override val currentPositionMillis: Long
        get() = exoPlayer?.currentPosition ?: 0L

    override val progress: Pair<Long, Long>?
        get() {
            val player = exoPlayer ?: return null
            if (player.playbackState == Player.STATE_READY || player.playbackState == Player.STATE_BUFFERING) {
                val currentPosition = player.currentPosition
                val duration = player.duration.coerceAtLeast(0L)
                return Pair(currentPosition, duration)
            }
            return null
        }

    override fun prepare(targetVolume: Float) {
        if (exoPlayer != null) {
            exoPlayer?.volume = targetVolume
            return
        }

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
                                when (playbackState) {
                                    Player.STATE_ENDED -> {
                                        onInternalStateUpdate(false, currentPosition)
                                        if (!hasFiredFinishedForCurrentItem) {
                                            hasFiredFinishedForCurrentItem = true
                                            onItemFinished()
                                        }
                                    }

                                    Player.STATE_READY -> {
                                        hasFiredFinishedForCurrentItem = false
                                        onInternalStateUpdate(playWhenReady, currentPosition)
                                    }

                                    Player.STATE_BUFFERING -> {
                                        onInternalStateUpdate(playWhenReady, currentPosition)
                                    }

                                    Player.STATE_IDLE -> {
                                        onInternalStateUpdate(false, currentPosition)
                                    }
                                }
                            }

                            override fun onIsPlayingChanged(playing: Boolean) {
                                onInternalStateUpdate(playing, currentPosition)
                                onPlaybackStateChange(playing)
                            }

                            override fun onPlayerError(error: PlaybackException) {
                                onInternalStateUpdate(false, currentPosition)
                            }
                        },
                    )
                }
    }

    override fun loadAndPlay(uri: String, targetVolume: Float) {
        hasFiredFinishedForCurrentItem = false
        prepare(targetVolume)
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

    override fun play(targetVolume: Float) {
        exoPlayer?.let { player ->
            player.volume = targetVolume
            player.playWhenReady = true
        }
    }

    override fun pause() {
        exoPlayer?.playWhenReady = false
    }

    override fun stop() {
        exoPlayer?.let { player ->
            try {
                player.stop()
                player.clearMediaItems()
            } catch (ignored: Exception) {
            }
        }
    }

    override fun seek(targetMillis: Long) {
        exoPlayer?.seekTo(targetMillis)
    }

    override fun setVolume(volume: Float) {
        exoPlayer?.volume = volume
    }

    override fun release() {
        exoPlayer?.release()
        exoPlayer = null
    }
}