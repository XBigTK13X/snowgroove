package com.simplepathstudios.snowgroove.audiocontrols

interface ISnowPlayer {
    fun loadAndPlay(
        uri: String?,
        targetVolume: Float?,
    )

    suspend fun getStatus(): PlayerStatus

    fun play(targetVolume: Float?)

    fun pause()

    fun resume()

    fun stop()

    fun seek(targetMillis: Long)

    fun setVolume(volume: Float)

    fun cleanup()
}
