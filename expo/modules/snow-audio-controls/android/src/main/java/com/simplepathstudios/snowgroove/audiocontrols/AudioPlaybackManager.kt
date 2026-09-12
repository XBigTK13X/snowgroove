package com.simplepathstudios.snowgroove.audiocontrols

import android.content.Context
import android.graphics.Bitmap
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat

class AudioPlaybackManager(
    private val context: Context,
    private val mediaSession: MediaSessionCompat,
    private val onPlaybackStateChange: (isPlaying: Boolean) -> Unit,
    private val onItemFinished: () -> Unit,
) {
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

    fun setMode(isRemoteMode: Boolean) {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("AudioPlaybackManager->setMode", "isRemoteMode: $isRemoteMode")
        }
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
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("AudioPlaybackManager->ensurePlayer", "targetVolume: $targetVolume")
        }
        activePlayer.prepare(targetVolume)
    }

    fun loadAndPlay(
        uri: String?,
        targetVolume: Float?,
    ) {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("AudioPlaybackManager->loadAndPlay", "uri: $uri, targetVolume: $targetVolume")
        }
        activePlayer.loadAndPlay(uri, targetVolume)
    }

    fun play(targetVolume: Float) {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("AudioPlaybackManager->play", "targetVolume: $targetVolume")
        }
        activePlayer.play(targetVolume)
    }

    fun pause() {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("AudioPlaybackManager->pause", "Pausing active player")
        }
        activePlayer.pause()
    }

    fun stop() {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("AudioPlaybackManager->stop", "Stopping active player")
        }
        activePlayer.stop()
    }

    fun seek(targetMillis: Long) {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("AudioPlaybackManager->seek", "targetMillis: $targetMillis")
        }
        activePlayer.seek(targetMillis)
    }

    fun setVolume(volume: Float) {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("AudioPlaybackManager->setVolume", "volume: $volume")
        }
        activePlayer.setVolume(volume)
    }

    fun isPlaying(): Boolean = activePlayer.isPlaying

    fun getPlayerProgress(): Pair<Long, Long>? = activePlayer.progress

    fun syncRemotePlayback(
        isPlaying: Boolean,
        positionMillis: Long,
        durationMillis: Long = 0L,
    ) {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log(
                "AudioPlaybackManager->syncRemotePlayback",
                "isPlaying: $isPlaying, positionMillis: $positionMillis, durationMillis: $durationMillis",
            )
        }
        remotePlayer.syncRemoteState(isPlaying, positionMillis, durationMillis)
        if (activePlayer === remotePlayer) {
            syncSessionPlaybackState(isPlaying, positionMillis)
        }
    }

    fun updateMetadata(
        title: String?,
        artist: String?,
        album: String?,
        durationSeconds: Float?,
        artwork: Bitmap?,
    ) {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log(
                "AudioPlaybackManager->updateMetadata",
                "$title by $artist ($album), duration: ${durationSeconds}s, artwork: ${if (artwork != null) "present" else "null"}",
            )
        }
        val durationMs = ((durationSeconds ?: 0f) * 1000f).toLong()

        val metadata =
            MediaMetadataCompat
                .Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, artist)
                .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, album)
                .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, durationMs)
                .apply {
                    if (artwork != null) {
                        putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, artwork)
                        putBitmap(MediaMetadataCompat.METADATA_KEY_ART, artwork)
                    }
                }.build()

        mediaSession.setMetadata(metadata)
    }

    fun syncSessionPlaybackState(
        isPlaying: Boolean,
        explicitPositionMillis: Long? = null,
    ) {
        val currentPosition = explicitPositionMillis ?: activePlayer.currentPositionMillis

        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log(
                "AudioPlaybackManager->syncSessionPlaybackState",
                "isPlaying: $isPlaying, position: $currentPosition",
            )
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

        mediaSession.setPlaybackState(playbackState)
    }

    fun cleanup() {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("AudioPlaybackManager->cleanup", "Releasing players")
        }
        localPlayer.cleanup()
        remotePlayer.cleanup()
    }
}
