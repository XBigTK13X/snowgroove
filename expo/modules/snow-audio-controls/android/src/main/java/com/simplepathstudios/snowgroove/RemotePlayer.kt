package com.simplepathstudios.snowgroove.audiocontrols

import android.content.Context

class RemotePlayer : ISnowPlayer {
    override var isPlaying: Boolean = false
    override var currentPositionMillis: Long = 0L
    private var knownDurationMillis: Long = 0L

    override val progress: Pair<Long, Long>?
        get() = if (knownDurationMillis > 0L) Pair(currentPositionMillis, knownDurationMillis) else null

    fun syncRemoteState(
        playing: Boolean,
        positionMillis: Long,
        durationMillis: Long = 0L,
    ) {
        isPlaying = playing
        currentPositionMillis = positionMillis
        if (durationMillis > 0L) {
            knownDurationMillis = durationMillis
        }
    }

    override fun prepare(targetVolume: Float) {}

    override fun loadAndPlay(uri: String, targetVolume: Float) {
        isPlaying = true
    }

    override fun play(targetVolume: Float) {
        isPlaying = true
    }

    override fun pause() {
        isPlaying = false
    }

    override fun stop() {
        isPlaying = false
        currentPositionMillis = 0L
    }

    override fun seek(targetMillis: Long) {
        currentPositionMillis = targetMillis
    }

    override fun setVolume(volume: Float) {}

    override fun release() {
        isPlaying = false
        currentPositionMillis = 0L
    }
}