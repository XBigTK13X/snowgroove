package com.simplepathstudios.snowgroove.audiocontrols

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SnowAudioControlsModule : Module() {
    private var playbackService: MediaPlaybackService? = null
    private var isBound = false

    private fun safeSendEvent(name: String, body: Map<String, Any> = emptyMap()) {
        try {
            if (appContext.reactContext != null) {
                sendEvent(name, body)
            }
        } catch (ignored: Exception) {}
    }

    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            val binder = service as? MediaPlaybackService.LocalBinder
            playbackService = binder?.getService()

            playbackService?.onCommand = { command, data ->
                when (command) {
                    "seek" -> safeSendEvent("seek", data ?: emptyMap())
                    "volumeAdjust" -> safeSendEvent("volumeAdjust", data ?: emptyMap())
                    else -> safeSendEvent(command, data ?: emptyMap())
                }
            }

            playbackService?.onStatusUpdate = { status ->
                safeSendEvent("statusUpdate", status)
            }

            playbackService?.onFinished = {
                safeSendEvent("finished", emptyMap())
            }

            isBound = true
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            playbackService?.onCommand = null
            playbackService?.onStatusUpdate = null
            playbackService?.onFinished = null
            playbackService = null
            isBound = false
        }
    }

    override fun definition() = ModuleDefinition {
        Name("SnowAudioControls")

        Events("play", "pause", "next", "previous", "seek", "statusUpdate", "finished", "volumeAdjust")

        OnCreate {
            val context = appContext.reactContext ?: return@OnCreate
            val intent = Intent(context, MediaPlaybackService::class.java)
            ContextCompat.startForegroundService(context, intent)
            context.bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)
        }

        Function("play") { data: Map<String, Any> ->
            val uri = data["uri"] as? String ?: return@Function
            val title = data["title"] as? String ?: ""
            val artist = data["artist"] as? String ?: ""
            val album = data["album"] as? String ?: ""
            val artworkUrl = data["artworkUrl"] as? String
            val duration = (data["duration"] as? Number)?.toLong() ?: 0L

            playbackService?.loadAndPlay(uri, title, artist, album, artworkUrl, duration)
        }

        Function("resume") {
            playbackService?.play()
        }

        Function("pause") {
            playbackService?.pause()
        }

        Function("stop") {
            playbackService?.stop()
        }

        Function("seek") { seconds: Double ->
            playbackService?.seek(seconds)
        }

        Function("setVolume") { volume: Double ->
            playbackService?.setVolumeLevel(volume.toFloat())
        }

        Function("setRemoteControlMode") { data: Map<String, Any> ->
            val enabled = data["enabled"] as? Boolean ?: false
            val initialVolume = (data["initialVolume"] as? Number)?.toFloat() ?: 1.0f
            val baseUrl = data["baseUrl"] as? String
            val authToken = data["authToken"] as? String
            val sessionId = data["sessionId"] as? String

            playbackService?.setRemoteControlMode(enabled, initialVolume, baseUrl, authToken, sessionId)
        }

        Function("syncRemoteVolume") { volume: Double ->
            playbackService?.syncRemoteVolume(volume.toFloat())
        }

        Function("updateMetadata") { data: Map<String, Any> ->
            val title = data["title"] as? String ?: ""
            val artist = data["artist"] as? String ?: ""
            val album = data["album"] as? String ?: ""
            val artworkUrl = data["artworkUrl"] as? String
            val duration = (data["duration"] as? Number)?.toLong() ?: 0L
            val isPlaying = data["isPlaying"] as? Boolean ?: false

            playbackService?.updateRemoteMetadata(title, artist, album, artworkUrl, duration, isPlaying)
        }

        OnDestroy {
            val context = appContext.reactContext
            if (context != null && isBound) {
                try {
                    context.unbindService(serviceConnection)
                } catch (ignored: Exception) {}
                isBound = false
            }
        }
    }
}