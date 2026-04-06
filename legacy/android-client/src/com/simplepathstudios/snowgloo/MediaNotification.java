package com.simplepathstudios.snowgloo;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.session.MediaSession;

import androidx.lifecycle.Observer;

import com.simplepathstudios.snowgloo.api.model.MusicFile;
import com.simplepathstudios.snowgloo.api.model.MusicQueue;
import com.simplepathstudios.snowgloo.viewmodel.ObservableMusicQueue;

public class MediaNotification {
    public static final class Action {
        public static final String PLAY = "com.simplepathstudios.snowgloo.play";
        public static final String PAUSE = "com.simplepathstudios.snowgloo.pause";
        public static final String NEXT = "com.simplepathstudios.snowgloo.next";
        public static final String PREVIOUS = "com.simplepathstudios.snowgloo.previous";
        public static final String VIEW_NOW_PLAYING = "com.simplepathstudios.snowgloo.view-now-playing";
    }
    public static final Integer NOTIFICATION_ID = 776677;
    private static final String NOTIFICATION_NAME = "Snowgloo";
    private static final String NOTIFICATION_CHANNEL_ID = "com.simplepathstudios.snowgloo";
    private static MediaNotification __instance;
    public static MediaNotification getInstance(){
        return __instance;
    }

    public static void registerActivity(MainActivity mainActivity){
        __instance = new MediaNotification(mainActivity);
    }

    public Notification notification;
    public NotificationManager notificationManager;

    private MediaNotification(MainActivity mainActivity){
        String description = "Snowgloo controls and information about playing media.";
        int importance = NotificationManager.IMPORTANCE_LOW;
        NotificationChannel channel = new NotificationChannel(NOTIFICATION_CHANNEL_ID, NOTIFICATION_NAME, importance);
        channel.setDescription(description);
        notificationManager = mainActivity.getSystemService(NotificationManager.class);
        notificationManager.createNotificationChannel(channel);

        Intent viewNowPlayingIntent = new Intent(MainActivity.getInstance().getApplicationContext(), MainActivity.class);
        viewNowPlayingIntent.setAction(Action.VIEW_NOW_PLAYING);
        PendingIntent viewNowPlayingPendingIntent = PendingIntent.getActivity(MainActivity.getInstance(), (int)System.currentTimeMillis(), viewNowPlayingIntent, PendingIntent.FLAG_IMMUTABLE);

        PendingIntent playIntent = PendingIntent.getBroadcast(Util.getGlobalContext(), 0, new Intent(Action.PLAY), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Action playAction= new Notification.Action.Builder(R.drawable.ic_play_arrow_white_24dp, "Play", playIntent).build();

        PendingIntent pauseIntent = PendingIntent.getBroadcast(Util.getGlobalContext(), 0, new Intent(Action.PAUSE), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Action pauseAction= new Notification.Action.Builder(R.drawable.ic_pause_white_24dp, "Pause", pauseIntent).build();

        PendingIntent nextIntent = PendingIntent.getBroadcast(Util.getGlobalContext(), 0, new Intent(Action.NEXT), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Action nextAction= new Notification.Action.Builder(R.drawable.ic_skip_next_white_24dp, "Next", nextIntent).build();

        PendingIntent previousIntent = PendingIntent.getBroadcast(Util.getGlobalContext(), 0, new Intent(Action.PREVIOUS), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Action previousAction = new Notification.Action.Builder(R.drawable.ic_skip_previous_white_24dp, "Previous", previousIntent).build();



        ObservableMusicQueue.getInstance().observe(new Observer<MusicQueue>() {
            @Override
            public void onChanged(MusicQueue musicQueue) {
                if(musicQueue != null && musicQueue.currentIndex != null && SnowglooService.getInstance() != null && SnowglooService.getInstance().getMediaSession() != null){
                    MusicFile currentSong = musicQueue.getCurrent();
                    MediaSession.Token token = SnowglooService.getInstance().getMediaSession().getSessionToken();
                    Notification.MediaStyle notificationStyle = new Notification.MediaStyle();
                    notificationStyle.setMediaSession(token);
                    notification = new Notification.Builder(MainActivity.getInstance(), NOTIFICATION_NAME)
                            .setSmallIcon(R.drawable.ic_notification)
                            .setContentTitle(currentSong.Title)
                            .setContentText(currentSong.DisplayAlbum)
                            .setLargeIcon(ObservableMusicQueue.getInstance().getCurrentAlbumArt())
                            .setSubText(currentSong.DisplayArtist)
                            .setStyle(notificationStyle)
                            .setChannelId(NOTIFICATION_CHANNEL_ID)
                            .setContentIntent(viewNowPlayingPendingIntent)
                            .addAction(previousAction)
                            .addAction(playAction)
                            .addAction(pauseAction)
                            .addAction(nextAction)
                            .build();
                    notificationManager.notify(NOTIFICATION_ID, notification);
                    SnowglooService.getInstance().startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);

                }
            }
        });
    }

    public void close(){
        if(notificationManager != null){
            notificationManager.cancel(NOTIFICATION_ID);
        }
    }

}