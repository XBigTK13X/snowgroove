package com.simplepathstudios.snowgroove.audiocontrols

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.os.Build
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.core.app.NotificationCompat
import androidx.media.app.NotificationCompat.MediaStyle
import androidx.media.session.MediaButtonReceiver

class PlaybackNotificationManager(
    private val service: Service,
) {
    val notificationChannelId = "snowgroove_playback_channel"
    val notificationId = 9914

    private val notificationManager = service.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    init {
        createNotificationChannel()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel =
                NotificationChannel(
                    notificationChannelId,
                    "Snowgroove Playback",
                    NotificationManager.IMPORTANCE_LOW,
                ).apply {
                    description = "Media controls and audio playback"
                    setShowBadge(false)
                }
            notificationManager.createNotificationChannel(channel)
        }
    }

    fun buildNotification(
        session: MediaSessionCompat,
        title: String,
        artist: String,
        isPlaying: Boolean,
        artwork: Bitmap?,
    ): Notification {
        val launchIntent = service.packageManager.getLaunchIntentForPackage(service.packageName)
        val contentPendingIntent =
            PendingIntent.getActivity(
                service,
                0,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )

        val smallIconResId =
            service.resources.getIdentifier("ic_launcher", "mipmap", service.packageName).let {
                if (it != 0) it else android.R.drawable.ic_media_play
            }

        val playPauseAction =
            if (isPlaying) {
                NotificationCompat.Action(
                    android.R.drawable.ic_media_pause,
                    "Pause",
                    MediaButtonReceiver.buildMediaButtonPendingIntent(service, PlaybackStateCompat.ACTION_PAUSE),
                )
            } else {
                NotificationCompat.Action(
                    android.R.drawable.ic_media_play,
                    "Play",
                    MediaButtonReceiver.buildMediaButtonPendingIntent(service, PlaybackStateCompat.ACTION_PLAY),
                )
            }

        val prevAction =
            NotificationCompat.Action(
                android.R.drawable.ic_media_previous,
                "Previous",
                MediaButtonReceiver.buildMediaButtonPendingIntent(service, PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS),
            )

        val nextAction =
            NotificationCompat.Action(
                android.R.drawable.ic_media_next,
                "Next",
                MediaButtonReceiver.buildMediaButtonPendingIntent(service, PlaybackStateCompat.ACTION_SKIP_TO_NEXT),
            )

        val builder =
            NotificationCompat
                .Builder(service, notificationChannelId)
                .setSmallIcon(smallIconResId)
                .setContentTitle(title.ifEmpty { "Snowgroove" })
                .setContentText(artist)
                .setContentIntent(contentPendingIntent)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(isPlaying)
                .addAction(prevAction)
                .addAction(playPauseAction)
                .addAction(nextAction)
                .setStyle(
                    MediaStyle()
                        .setMediaSession(session.sessionToken)
                        .setShowActionsInCompactView(0, 1, 2),
                )

        if (artwork != null) {
            builder.setLargeIcon(artwork)
        }

        return builder.build()
    }

    fun startForegroundService(notification: Notification) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                service.startForeground(notificationId, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
            } else {
                service.startForeground(notificationId, notification)
            }
        } catch (ignored: Exception) {
        }
    }

    fun updateNotification(
        session: MediaSessionCompat,
        title: String,
        artist: String,
        isPlaying: Boolean,
        artwork: Bitmap?,
    ) {
        val notification = buildNotification(session, title, artist, isPlaying, artwork)
        startForegroundService(notification)
    }

    fun stopForegroundNotification() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                service.stopForeground(Service.STOP_FOREGROUND_REMOVE)
            } else {
                @Suppress("DEPRECATION")
                service.stopForeground(true)
            }
            notificationManager.cancel(notificationId)
        } catch (ignored: Exception) {
        }
    }
}
