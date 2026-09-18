package com.simplepathstudios.snowgroove.audiocontrols

import android.content.Context

class RemotePlayer(
    val remotePlayerId: Int,
    val musicSessionId: Int,
) : ISnowPlayer {
    override fun loadAndPlay(
        uri: String?,
        targetVolume: Double?,
    ) {
        ApiClient.playMusicSession(musicSessionId)
    }

    override suspend fun getStatus(): PlayerStatus {
        val remotePlayerStatus = ApiClient.getRemotePlayerStatus(remotePlayerId)
        return PlayerStatus(
            positionSeconds = remotePlayerStatus?.positionSeconds ?: 0L,
            isPlaying = remotePlayerStatus?.isPlaying ?: false,
            playerState = remotePlayerStatus?.playerState ?: "stopped",
            queueFingerprint = remotePlayerStatus?.queueFingerprint ?: "",
            currentSongIndex = remotePlayerStatus?.currentSongIndex ?: 0,
        )
    }

    override fun play(targetVolume: Double?) {
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

    override fun seek(seconds: Double) {
        ApiClient.seekMusicSession(musicSessionId, seconds)
    }

    override fun setVolume(volume: Double) {
        ApiClient.setRemoteVolume(musicSessionId, volume.toDouble())
    }

    override fun cleanup() {
    }
}
