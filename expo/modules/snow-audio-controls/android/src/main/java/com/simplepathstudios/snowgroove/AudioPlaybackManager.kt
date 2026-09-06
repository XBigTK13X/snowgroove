package com.simplepathstudios.snowgroove.audiocontrols

import android.app.PendingIntent
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.media.AudioManager
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.media.session.MediaButtonReceiver

class AudioPlaybackManager(
    private val context: Context,
    private val onPlaybackStateChange: (isPlaying: Boolean) -> Unit,
    private val onItemFinished: () -> Unit,
    private val onCommandAction: (String, Map<String, Any>?) -> Unit,
    private val onSeekAction: (Double) -> Unit,
) {
    var mediaSession: MediaSessionCompat? = null
        private set

    private val localPlayer: LocalPlayer =
        LocalPlayer(
            context = context,
            onPlaybackStateChange = onPlaybackStateChange,
            onItemFinished = onItemFinished,
            onInternalStateUpdate = { isPlaying: Boolean, positionMillis: Long ->
                if (activePlayer === localPlayer) {
                    syncSessionPlaybackState(isPlaying, positionMillis)
                }
            },
        )

    private val remotePlayer: RemotePlayer = RemotePlayer()
    private var activePlayer: ISnowPlayer = localPlayer

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
                    PendingIntent.getBroadcast(
                        context,
                        0,
                        mediaButtonIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
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

    fun setMode(isRemoteMode: Boolean) {
        if (isRemoteMode) {
            if (activePlayer === localPlayer) {
                localPlayer.pause()
            }
            activePlayer = remotePlayer
        } else {
            activePlayer = localPlayer
        }
    }

    fun ensurePlayer(targetVolume: Float) {
        activePlayer.prepare(targetVolume)
    }

    fun loadAndPlay(
        uri: String,
        targetVolume: Float,
    ) {
        activePlayer.loadAndPlay(uri, targetVolume)
    }

    fun play(targetVolume: Float) {
        activePlayer.play(targetVolume)
    }

    fun pause() {
        activePlayer.pause()
    }

    fun stop() {
        activePlayer.stop()
    }

    fun seek(targetMillis: Long) {
        activePlayer.seek(targetMillis)
    }

    fun setVolume(volume: Float) {
        activePlayer.setVolume(volume)
    }

    fun isPlaying(): Boolean = activePlayer.isPlaying

    fun getPlayerProgress(): Pair<Long, Long>? = activePlayer.progress

    fun syncRemotePlayback(
        isPlaying: Boolean,
        positionMillis: Long,
        durationMillis: Long = 0L,
    ) {
        remotePlayer.syncRemoteState(isPlaying, positionMillis, durationMillis)
        if (activePlayer === remotePlayer) {
            syncSessionPlaybackState(isPlaying, positionMillis)
        }
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

    fun syncSessionPlaybackState(
        isPlaying: Boolean,
        explicitPositionMillis: Long? = null,
    ) {
        val session = mediaSession ?: return
        val currentPosition = explicitPositionMillis ?: activePlayer.currentPositionMillis

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
        localPlayer.release()
        remotePlayer.release()
        mediaSession?.isActive = false
        mediaSession?.release()
        mediaSession = null
    }
}