package com.simplepathstudios.snowgroove.audiocontrols

import android.content.Context
import android.database.ContentObserver
import android.media.AudioManager
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings

// This only cares about managing volume keypresses to remote devices
// Typical Android system volume management works fine for local playback

class VolumeManager(
    private val context: Context,
) {
    private val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
    private val wakeLock: PowerManager.WakeLock =
        powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "snowgroove:volume_wake_lock",
        )

    private var volumeObserver: ContentObserver? = null
    private var lastObservedStreamVolume = -1
    private var isProgrammaticVolumeChange = false

    var musicSessionId: Int? = null
    var volumePercent: Double? = 0.0

    fun setInitialVolume(
        sessionId: Int?,
        volume: Double?,
    ) {
        if ((volumePercent == 0.0 && volume ?: 0.0 > 0.0) || (musicSessionId != sessionId)) {
            musicSessionId = sessionId
            volumePercent = volume
        }
    }

    fun setVolume(volume: Double?) {
        volumePercent = volume?.coerceIn(0.0, 1.0) ?: 0.0
    }

    fun registerObserver() {
        if (volumeObserver != null) return

        val maxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
        val centerVolume = maxVolume / 2

        isProgrammaticVolumeChange = true
        audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, centerVolume, 0)
        lastObservedStreamVolume = centerVolume

        val observer =
            object : ContentObserver(Handler(Looper.getMainLooper())) {
                override fun onChange(selfChange: Boolean) {
                    super.onChange(selfChange)

                    if (isProgrammaticVolumeChange) {
                        isProgrammaticVolumeChange = false
                        SnowEvents.send("volumeChanged", mapOf("ignored" to volumePercent))
                        return
                    }

                    val currentStreamVolume = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
                    val delta = currentStreamVolume - lastObservedStreamVolume
                    if (delta != 0) {
                        val volumeStep = if (delta > 0) 0.05 else -0.05
                        volumePercent = ((volumePercent ?: 0.0) + volumeStep).coerceIn(0.0, 1.0)

                        isProgrammaticVolumeChange = true
                        audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, centerVolume, 0)
                        lastObservedStreamVolume = centerVolume

                        val sessionId = musicSessionId ?: return
                        ApiClient.setRemoteVolume(sessionId, volumePercent ?: 0.0, wakeLock)
                        SnowEvents.send("volumeChanged", mapOf("percent" to volumePercent, "remoteId" to sessionId))
                    }
                }
            }

        volumeObserver = observer
        context.contentResolver.registerContentObserver(
            Settings.System.CONTENT_URI,
            true,
            observer,
        )
    }

    fun unregisterObserver() {
        volumePercent = 0.0
        musicSessionId = null
        volumeObserver?.let {
            context.contentResolver.unregisterContentObserver(it)
            volumeObserver = null
        }
    }

    fun cleanup() {
        unregisterObserver()
        try {
            if (wakeLock.isHeld) {
                wakeLock.release()
            }
        } catch (ignored: Exception) {
        }
    }
}
