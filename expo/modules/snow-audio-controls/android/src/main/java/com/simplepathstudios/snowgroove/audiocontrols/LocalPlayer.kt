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
    private val onItemFinished: () -> Unit,
) : ISnowPlayer {
    private var exoPlayer: ExoPlayer? = null
    private var hasFiredFinishedForCurrentItem = false

    val progress: Pair<Long, Long>?
        get() {
            val player = exoPlayer ?: return null
            if (player.playbackState == Player.STATE_READY || player.playbackState == Player.STATE_BUFFERING) {
                val currentPosition = player.currentPosition
                val duration = player.duration.coerceAtLeast(0L)
                return Pair(currentPosition, duration)
            }
            return null
        }

    fun prepare(targetVolume: Double) {
        if (exoPlayer != null) {
            exoPlayer?.volume = targetVolume.toFloat()
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
                    volume = targetVolume.toFloat()
                    addListener(
                        object : Player.Listener {
                            override fun onPlaybackStateChanged(playbackState: Int) {
                                when (playbackState) {
                                    Player.STATE_ENDED -> {
                                        if (!hasFiredFinishedForCurrentItem) {
                                            hasFiredFinishedForCurrentItem = true
                                            onItemFinished()
                                        }
                                    }

                                    Player.STATE_READY -> {
                                        hasFiredFinishedForCurrentItem = false
                                    }

                                    Player.STATE_BUFFERING -> {
                                    }

                                    Player.STATE_IDLE -> {
                                    }
                                }
                            }

                            override fun onIsPlayingChanged(playing: Boolean) {
                            }

                            override fun onPlayerError(error: PlaybackException) {
                            }
                        },
                    )
                }
    }

    override suspend fun getStatus(): PlayerStatus =
        PlayerStatus(
            isPlaying = exoPlayer?.isPlaying == true,
            positionSeconds = ((exoPlayer?.currentPosition ?: 0L) / 1000L) ?: 0L,
        )

    override fun loadAndPlay(
        uri: String?,
        targetVolume: Double?,
    ) {
        val validUri = uri ?: return
        val validVolume = targetVolume ?: 1.0
        hasFiredFinishedForCurrentItem = false
        prepare(validVolume)
        exoPlayer?.let { player ->
            player.repeatMode = Player.REPEAT_MODE_OFF
            player.volume = validVolume.toFloat()
            player.stop()
            player.clearMediaItems()
            val mediaItem = MediaItem.fromUri(validUri)
            player.setMediaItem(mediaItem)
            player.prepare()
            player.playWhenReady = true
        }
    }

    override fun play(targetVolume: Double?) {
        exoPlayer?.let { player ->
            player.volume = targetVolume?.toFloat() ?: 1.0f
            player.playWhenReady = true
        }
    }

    override fun pause() {
        exoPlayer?.playWhenReady = false
    }

    override fun resume() {
        exoPlayer?.playWhenReady = true
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

    override fun seek(seconds: Double) {
        exoPlayer?.seekTo(seconds.toLong())
    }

    override fun setVolume(volume: Double) {
        exoPlayer?.volume = volume.toFloat()
    }

    override fun cleanup() {
        exoPlayer?.release()
        exoPlayer = null
    }
}
