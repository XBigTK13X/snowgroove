package com.simplepathstudios.snowgroove.audiocontrols

import kotlinx.serialization.json.Json

object SnowConfig {
    val DEBUG_ANDROID_AUDIO: String? = null
    const val USER_INPUT_DEBOUNCE_MILLISECONDS = 1000
    const val WAKE_LOCK_TIMEOUT_MILLISECONDS = 4000L
    const val REMOTE_POLLING_DELAY_MILLISECONDS = 1000L
    val JSON_RULES =
        Json {
            ignoreUnknownKeys = true
            isLenient = true
            encodeDefaults = true
            explicitNulls = false
        }
}
