package com.simplepathstudios.snowgroove.audiocontrols

object SnowEvents {
    const val DEBUG_ANDROID_AUDIO = true
    private var eventEmitter: ((eventName: String, params: Map<String, Any>) -> Unit)? = null

    fun setEventEmitter(emitter: ((eventName: String, params: Map<String, Any>) -> Unit)?) {
        eventEmitter = emitter
    }

    fun log(nativeOwner: String, message: String) {
        send("log", mapOf("nativeOwner" to nativeOwner, "message" to message))
    }

    fun send(eventName: String, payload: Map<String, Any> = emptyMap()) {
        eventEmitter?.invoke(eventName, payload)
    }
}