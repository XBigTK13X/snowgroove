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
                    syncSessionPlaybackState(isPlaying, (positionMillis / 1000.0))
                }
            },
        )

    private var musicSession: MusicSession? = null
    private var activePlayer: ISnowPlayer = localPlayer

    fun setSession(
        playerId: Int?,
        session: MusicSession,
    ) {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("AudioPlaybackManager->setMode", "playerId: $playerId")
        }
        if (playerId != null) {
            if (activePlayer === localPlayer) {
                localPlayer.pause()
            }
            playerId?.let { remoteId ->
                session?.id?.let { sessionId ->
                    activePlayer = RemotePlayer(remoteId, sessionId)
                }
            }
        } else {
            activePlayer = localPlayer
        }
    }

    fun loadAndPlay(
        uri: String?,
        targetVolume: Double?,
    ) {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("AudioPlaybackManager->loadAndPlay", "uri: $uri, targetVolume: $targetVolume")
        }
        activePlayer.loadAndPlay(uri, targetVolume)
    }

    fun play(targetVolume: Double) {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("AudioPlaybackManager->play", "targetVolume: $targetVolume")
        }
        activePlayer.play(targetVolume)
    }

    fun resume() {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("AudioPlaybackManager->resume", "Resuming active player")
        }
        activePlayer.resume()
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

    fun seek(seconds: Double) {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("AudioPlaybackManager->seek", "seconds: $seconds")
        }
        activePlayer.seek(seconds)
        syncSessionPlaybackState(true, seconds)
    }

    fun setVolume(volume: Double) {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("AudioPlaybackManager->setVolume", "volume: $volume")
        }
        activePlayer.setVolume(volume)
    }

    fun updateMetadata(
        title: String?,
        artist: String?,
        album: String?,
        durationSeconds: Double?,
        artwork: Bitmap?,
    ) {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log(
                "AudioPlaybackManager->updateMetadata",
                "$title by $artist ($album), duration: ${durationSeconds}s, artwork: ${if (artwork != null) "present" else "null"}",
            )
        }
        val durationMs = ((durationSeconds ?: 0.0) * 1000.0).toLong()

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

    suspend fun getStatus() = activePlayer.getStatus()

    fun syncSessionPlaybackState(
        isPlaying: Boolean? = false,
        positionSeconds: Double? = null,
    ) {
        val currentPosition = positionSeconds?.toLong() ?: 0L

        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log(
                "AudioPlaybackManager->syncSessionPlaybackState",
                "isPlaying: $isPlaying, position: $currentPosition",
            )
        }

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
                .setState(stateCode, currentPosition, if (isPlaying ?: false) 1.0f else 0.0f)
                .setActions(actions)
                .build()

        mediaSession.setPlaybackState(playbackState)
    }

    fun cleanup() {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("AudioPlaybackManager->cleanup", "Releasing players")
        }
        localPlayer.cleanup()
        if (activePlayer != localPlayer) {
            activePlayer.cleanup()
        }
    }
}
