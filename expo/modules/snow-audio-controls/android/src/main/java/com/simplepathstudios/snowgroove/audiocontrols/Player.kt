package com.simplepathstudios.snowgroove.audiocontrols

import android.content.Context

class Player(
    private val context: Context,
    private val onItemFinished: () -> Unit,
) {
    private val localPlayer: LocalPlayer =
        LocalPlayer(
            context = context,
            onItemFinished = onItemFinished,
        )

    private var musicSession: MusicSession? = null
    private var activePlayer: ISnowPlayer = localPlayer

    suspend fun getStatus() = activePlayer.getStatus()

    fun setSession(
        playerId: Int?,
        session: MusicSession,
    ) {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("Player->setMode", "playerId: $playerId")
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
            SnowEvents.log("Player->loadAndPlay", "uri: $uri, targetVolume: $targetVolume")
        }
        activePlayer.loadAndPlay(uri, targetVolume)
    }

    fun play(targetVolume: Double) {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("Player->play", "targetVolume: $targetVolume")
        }
        activePlayer.play(targetVolume)
    }

    fun resume() {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("Player->resume", "Resuming active player")
        }
        activePlayer.resume()
    }

    fun pause() {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("Player->pause", "Pausing active player")
        }
        activePlayer.pause()
    }

    fun stop() {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("Player->stop", "Stopping active player")
        }
        activePlayer.stop()
    }

    fun seek(seconds: Double) {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("Player->seek", "seconds: $seconds")
        }
        activePlayer.seek(seconds)
    }

    fun setVolume(volume: Double) {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("Player->setVolume", "volume: $volume")
        }
        activePlayer.setVolume(volume)
    }

    fun cleanup() {
        if (SnowConfig.DEBUG_ANDROID_AUDIO != null) {
            SnowEvents.log("Player->cleanup", "Releasing players")
        }
        localPlayer.cleanup()
        if (activePlayer != localPlayer) {
            activePlayer.cleanup()
        }
    }
}
