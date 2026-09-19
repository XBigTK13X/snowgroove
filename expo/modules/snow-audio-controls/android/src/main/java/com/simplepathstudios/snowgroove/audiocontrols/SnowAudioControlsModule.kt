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
    private var service: SnowgrooveService? = null
    private var isBound = false

    private fun safeSendEvent(
        name: String,
        body: Map<String, Any?> = emptyMap(),
    ) {
        try {
            if (appContext.reactContext != null) {
                sendEvent(name, body)
            }
        } catch (ignored: Exception) {
        }
    }

    private val serviceConnection =
        object : ServiceConnection {
            override fun onServiceConnected(
                name: ComponentName?,
                binderService: IBinder?,
            ) {
                val binder = binderService as? SnowgrooveService.LocalBinder
                service = binder?.getService()

                service?.onStatusUpdate = { status ->
                    safeSendEvent("statusUpdate", status.toMap())
                }

                service?.onFinished = {
                    safeSendEvent("finished", emptyMap())
                }

                isBound = true
            }

            override fun onServiceDisconnected(name: ComponentName?) {
                service?.onStatusUpdate = null
                service?.onFinished = null
                service = null
                isBound = false
            }
        }

    override fun definition() =
        ModuleDefinition {
            Name("SnowAudioControls")

            Events(
                "apiConfigured",
                "error",
                "finished",
                "log",
                "statusUpdate",
                "sessionChanged",
                "volumeChanged",
            )

            OnCreate {
                SnowEvents.setEventEmitter { eventName, payload ->
                    safeSendEvent(eventName, payload)
                }

                val context = appContext.reactContext ?: return@OnCreate
                val intent = Intent(context, SnowgrooveService::class.java)
                ContextCompat.startForegroundService(context, intent)
                context.bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)
            }

            Function("configureApi") { baseUrl: String, token: String ->
                ApiClient.configure(baseUrl, token)
                SnowEvents.send("apiConfigured")
            }

            Function("changeTargetPlayer") { id: Int?, name: String? ->
                service?.changeTargetPlayer(id, name)
            }

            Function("play") { audioFile: AudioFile ->
                service?.play(audioFile)
            }

            Function("resume") {
                service?.resume()
            }

            Function("pause") {
                service?.pause()
            }

            Function("stop") {
                service?.stop()
            }

            Function("seek") { seconds: Double ->
                service?.seek(seconds)
            }

            Function("setVolume") { volume: Double ->
                service?.setVolumeLevel(volume)
            }

            Function("moveCurrentIndex") { amount: Int ->
                service?.moveCurrentIndex(amount)
            }

            Function("clearQueue") {
                service?.clearQueue()
            }

            Function("shuffleQueue") {
                service?.shuffleQueue()
            }

            // If these AudioFile methods fail to be called
            // It is likely a new property hanging off the server api model.
            // Those all need to be mapped in SnowModels, or else it fails without warning
            Function("addToQueue") { audioFiles: List<AudioFile> ->
                service?.addToQueue(audioFiles)
            }

            Function("removeFromQueue") { audioFiles: List<AudioFile> ->
                service?.removeFromQueue(audioFiles)
            }

            Function("moveQueueItem") { oldIndex: Int, newIndex: Int ->
                service?.moveQueueItem(oldIndex, newIndex)
            }

            Function("playNext") { audioFile: AudioFile ->
                service?.playNext(audioFile)
            }

            OnDestroy {
                SnowEvents.setEventEmitter(null)
                val context = appContext.reactContext
                if (context != null && isBound) {
                    try {
                        context.unbindService(serviceConnection)
                    } catch (ignored: Exception) {
                    }
                    isBound = false
                }
            }
        }
}
