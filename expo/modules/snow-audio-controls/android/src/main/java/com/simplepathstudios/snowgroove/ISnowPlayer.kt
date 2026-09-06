package com.simplepathstudios.snowgroove.audiocontrols

interface ISnowPlayer {
    val isPlaying: Boolean
    val progress: Pair<Long, Long>?
    val currentPositionMillis: Long

    fun prepare(targetVolume: Float)
    fun loadAndPlay(uri: String, targetVolume: Float)
    fun play(targetVolume: Float)
    fun pause()
    fun stop()
    fun seek(targetMillis: Long)
    fun setVolume(volume: Float)
    fun release()
}