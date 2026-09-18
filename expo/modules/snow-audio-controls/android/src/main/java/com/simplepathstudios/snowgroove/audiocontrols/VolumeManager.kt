package com.simplepathstudios.snowgroove.audiocontrols

import android.content.Context
import android.database.ContentObserver
import android.media.AudioManager
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings

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

    var targetVolume: Double = 1.0
        private set

    var remoteVolumePercent: Double = 1.0
        private set

    var remoteSessionId: Int? = null

    fun setLocalVolumeLevel(percent: Double) {
        targetVolume = percent.coerceIn(0.0, 1.0)
    }

    fun syncRemoteVolume(percent: Double) {
        remoteVolumePercent = percent.toDouble().coerceIn(0.0, 1.0)
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
                        return
                    }

                    val currentStreamVolume = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
                    val delta = currentStreamVolume - lastObservedStreamVolume
                    if (delta != 0) {
                        val volumeStep = if (delta > 0) 0.05 else -0.05
                        remoteVolumePercent = (remoteVolumePercent + volumeStep).coerceIn(0.0, 1.0)

                        isProgrammaticVolumeChange = true
                        audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, centerVolume, 0)
                        lastObservedStreamVolume = centerVolume

                        sendRemoteVolume()
                        SnowEvents.send("volumeChanged", mapOf("percent" to remoteVolumePercent))
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
        volumeObserver?.let {
            context.contentResolver.unregisterContentObserver(it)
            volumeObserver = null
        }
    }

    private fun sendRemoteVolume() {
        val sessionId = remoteSessionId ?: return
        ApiClient.setRemoteVolume(sessionId, remoteVolumePercent, wakeLock)
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
