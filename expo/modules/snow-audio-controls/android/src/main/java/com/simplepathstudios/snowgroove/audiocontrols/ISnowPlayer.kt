package com.simplepathstudios.snowgroove.audiocontrols

interface ISnowPlayer {
    fun loadAndPlay(
        uri: String?,
        targetVolume: Double?,
    )

    suspend fun getStatus(): PlayerStatus

    fun play(targetVolume: Double?)

    fun pause()

    fun resume()

    fun stop()

    fun seek(seconds: Double)

    fun setVolume(volume: Double)

    fun cleanup()
}
