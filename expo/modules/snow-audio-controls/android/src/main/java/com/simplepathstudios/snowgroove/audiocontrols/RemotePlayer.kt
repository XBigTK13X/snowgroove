package com.simplepathstudios.snowgroove.audiocontrols

import android.content.Context

class RemotePlayer(
    val remotePlayerId: Int,
    val musicSessionId: Int,
) : ISnowPlayer {
    override fun loadAndPlay(
        uri: String?,
        targetVolume: Float?,
    ) {
    }

    override suspend fun getStatus(): PlayerStatus {
        val remotePlayerStatus = ApiClient.getRemotePlayerStatus(remotePlayerId)
        return PlayerStatus(
            positionSeconds = remotePlayerStatus?.positionSeconds ?: 0L,
            isPlaying = remotePlayerStatus?.isPlaying ?: false,
        )
    }

    override fun play(targetVolume: Float?) {
        ApiClient.playMusicSession(musicSessionId)
    }

    override fun pause() {
        ApiClient.pauseMusicSession(musicSessionId)
    }

    override fun resume() {
        ApiClient.playMusicSession(musicSessionId)
    }

    override fun stop() {
        ApiClient.stopMusicSession(musicSessionId)
    }

    override fun seek(targetMillis: Long) {
        ApiClient.seekMusicSession(musicSessionId, targetMillis.toDouble())
    }

    override fun setVolume(volume: Float) {}

    override fun cleanup() {
    }
}
