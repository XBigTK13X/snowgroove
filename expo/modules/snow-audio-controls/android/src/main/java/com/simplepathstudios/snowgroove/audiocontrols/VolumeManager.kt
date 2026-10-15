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

    private val handler = Handler(Looper.getMainLooper())
    private var volumeObserver: ContentObserver? = null

    private var centerVolume = -1
    private var isPaused = false

    var musicSessionId: Int? = null
    var volumePercent: Double? = 0.0

    private fun calculateCenterVolume(): Int {
        val maxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
        return maxVolume / 2
    }

    private fun forceCenterStream() {
        centerVolume = calculateCenterVolume()
        val currentVolume = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
        if (currentVolume != centerVolume) {
            audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, centerVolume, 0)
        }
    }

    fun pause() {
        isPaused = true
    }

    fun resume() {
        isPaused = false
        forceCenterStream()
    }

    fun setInitialVolume(
        sessionId: Int?,
        volume: Double?,
    ) {
        if ((volumePercent == 0.0 && (volume ?: 0.0) > 0.0) || (musicSessionId != sessionId)) {
            musicSessionId = sessionId
            volumePercent = volume
        }
    }

    fun setVolume(volume: Double?) {
        volumePercent = volume?.coerceIn(0.0, 1.0) ?: 0.0
    }

    fun registerObserver() {
        if (volumeObserver != null) return

        isPaused = false
        centerVolume = calculateCenterVolume()
        audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, centerVolume, 0)

        val observer =
            object : ContentObserver(handler) {
                override fun onChange(selfChange: Boolean) {
                    super.onChange(selfChange)

                    if (isPaused) {
                        return
                    }

                    val currentVolume = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)

                    // If the current volume is centerVolume, this change event was triggered
                    // by our programmatic recenter. Drop it without locking state.
                    if (currentVolume == centerVolume) {
                        return
                    }

                    val delta = currentVolume - centerVolume
                    val volumeStep = if (delta > 0) 0.05 else -0.05
                    volumePercent = ((volumePercent ?: 0.0) + volumeStep).coerceIn(0.0, 1.0)

                    // Snap the local stream back to center so subsequent rocker presses
                    // never hit min/max rails and continue generating deltas.
                    audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, centerVolume, 0)

                    val sessionId = musicSessionId ?: return
                    ApiClient.setRemoteVolume(sessionId, volumePercent ?: 0.0, wakeLock)
                    SnowEvents.send(
                        "volumeChanged",
                        mapOf("percent" to volumePercent, "remoteId" to sessionId),
                    )
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
        isPaused = false
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
