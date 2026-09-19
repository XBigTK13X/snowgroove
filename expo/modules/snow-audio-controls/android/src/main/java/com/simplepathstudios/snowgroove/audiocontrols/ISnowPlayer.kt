package com.simplepathstudios.snowgroove.audiocontrols

interface ISnowPlayer {
    fun loadAndPlay(uri: String?)

    suspend fun getStatus(): PlayerStatus?

    fun play()

    fun pause()

    fun resume()

    fun stop()

    fun seek(seconds: Double)

    fun setVolume(volume: Double)

    fun cleanup()
}
