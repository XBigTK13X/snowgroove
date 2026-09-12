package com.simplepathstudios.snowgroove.audiocontrols

object SnowEvents {
    private var eventEmitter: ((eventName: String, params: Map<String, Any?>) -> Unit)? = null

    fun setEventEmitter(emitter: ((eventName: String, params: Map<String, Any?>) -> Unit)?) {
        eventEmitter = emitter
    }

    fun log(
        nativeOwner: String,
        message: String,
    ) {
        send("log", mapOf("nativeOwner" to nativeOwner, "message" to message))
    }

    fun send(kind: String) {
        send(kind, emptyMap())
    }

    fun send(
        kind: String,
        payload: Map<String, Any?>,
    ) {
        eventEmitter?.invoke(kind, payload)
    }
}
