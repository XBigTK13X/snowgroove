package com.simplepathstudios.snowgloo.audio;

import android.net.Uri;

import com.google.android.gms.cast.MediaInfo;
import com.google.android.gms.cast.MediaLoadOptions;
import com.google.android.gms.cast.MediaLoadRequestData;
import com.google.android.gms.cast.MediaMetadata;
import com.google.android.gms.cast.MediaSeekOptions;
import com.google.android.gms.cast.MediaStatus;
import com.google.android.gms.cast.framework.CastContext;
import com.google.android.gms.cast.framework.CastSession;
import com.google.android.gms.cast.framework.SessionManager;
import com.google.android.gms.cast.framework.media.RemoteMediaClient;
import com.google.android.gms.common.images.WebImage;
import com.simplepathstudios.snowgloo.MainActivity;
import com.simplepathstudios.snowgloo.Util;
import com.simplepathstudios.snowgloo.api.model.MusicFile;
import com.simplepathstudios.snowgloo.api.model.MusicQueue;
import com.simplepathstudios.snowgloo.viewmodel.ObservableCastContext;
import com.simplepathstudios.snowgloo.viewmodel.ObservableMusicQueue;

import static com.google.android.gms.cast.MediaSeekOptions.RESUME_STATE_PLAY;
import static com.google.android.gms.cast.MediaSeekOptions.RESUME_STATE_UNCHANGED;
import static com.google.android.gms.cast.MediaStatus.IDLE_REASON_FINISHED;

import org.json.JSONObject;

public class CastPlayer implements IAudioPlayer {

    private static final String TAG = "CastPlayer";

    private RemoteMediaClient mediaPlayer;
    private RemoteMediaClient.Callback mediaCallback;
    private Integer lastPlayerState;
    private Integer lastIdleReason;
    private CastContext castContext;

    public CastPlayer() {
        ObservableCastContext.getInstance().observe(castContext -> {
            this.castContext = castContext;
            readMediaSession();
        });
    }

    private MediaInfo prepareMedia(MusicFile musicFile) {
        Util.log(TAG, "prepareMedia " + musicFile.Id);
        MediaMetadata metadata = new MediaMetadata(MediaMetadata.MEDIA_TYPE_MUSIC_TRACK);
        metadata.putString(MediaMetadata.KEY_TITLE, musicFile.Title);
        metadata.putString(MediaMetadata.KEY_ARTIST, musicFile.DisplayArtist);
        metadata.putString(MediaMetadata.KEY_ALBUM_TITLE, musicFile.DisplayAlbum);

        metadata.addImage(new WebImage(Uri.parse(musicFile.ThumbnailCoverArt)));
        JSONObject jsonObject = new JSONObject();
        try {
            jsonObject.put("MUSIC_FILE_ID", musicFile.Id);
        } catch (Exception swallow) {

        }
        MediaInfo mediaInfo = new MediaInfo.Builder(musicFile.AudioUrl)
                .setStreamType(MediaInfo.STREAM_TYPE_BUFFERED)
                .setContentType("audio/mpeg")
                .setMetadata(metadata)
                .setCustomData(jsonObject)
                .build();

        return mediaInfo;

    }

    @Override
    public boolean isPlaying() {
        if (mediaPlayer != null) {
            return mediaPlayer.isPlaying();
        }
        return false;
    }

    @Override
    public void setVolume(double volume) {
        if (mediaPlayer != null) {
            mediaPlayer.setStreamVolume(volume);
        }
    }

    public SessionManager getSessionManager() {
        MainActivity activity = MainActivity.getInstance();
        if (activity == null) {
            return null;
        }
        if (castContext == null) {
            return null;
        }
        return castContext.getSessionManager();
    }

    public CastSession getCastSession() {
        if (getSessionManager() == null) {
            return null;
        }
        return getSessionManager().getCurrentCastSession();
    }

    public String getRemoteSongId() {
        if (mediaPlayer != null && mediaPlayer.getMediaInfo() != null && mediaPlayer.getMediaInfo().getMetadata() != null) {
            try {
                return mediaPlayer.getMediaInfo().getCustomData().getString("MUSIC_FILE_ID");
            } catch (Exception swallow) {

            }
        }
        return null;
    }

    public void readMediaSession() {
        CastSession castSession = getCastSession();
        if (castSession != null && castSession.getRemoteMediaClient() != null) {
            setMediaListener(true, null);
        }
        //setPlayerState(MusicQueue.PlayerState.PLAYING);
    }

    //stopOnConnect used for some setup jank. Need to take better notes on that.
    private void setMediaListener(boolean stopOnConnect, MusicFile musicFile) {
        try {
            if (mediaCallback != null && mediaPlayer != null) {
                mediaPlayer.unregisterCallback(mediaCallback);
            }
            mediaPlayer = getCastSession().getRemoteMediaClient();
            mediaCallback = new RemoteMediaClient.Callback() {
                @Override
                public void onQueueStatusUpdated() {
                    if (stopOnConnect) {
                        if (mediaPlayer.isPlaying()) {
                            String songId = getRemoteSongId();
                            Integer queueIndex = ObservableMusicQueue.getInstance().getIndex(songId);
                            if (queueIndex != null) {
                                ObservableMusicQueue.getInstance().setCurrentIndex(queueIndex);
                                AudioPlayer.getInstance().setPlayerState(MusicQueue.PlayerState.PLAYING);
                            } else {
                                Util.toast("Stopped casting, current song not in queue.");
                                mediaPlayer.stop();
                            }
                        }
                    }
                }

                @Override
                public void onStatusUpdated() {
                    if (!stopOnConnect && mediaPlayer != null) {
                        MediaStatus mediaStatus = mediaPlayer.getMediaStatus();
                        if (mediaStatus != null) {
                            int playerState = mediaStatus.getPlayerState();
                            int idleReason = mediaStatus.getIdleReason();
                            if (lastIdleReason == null || lastPlayerState == null || playerState != lastPlayerState || lastIdleReason != idleReason) {
                                Util.log(TAG, "Media status is "
                                        + Util.messageNumberToText(Util.MessageKind.CastPlayerState, playerState)
                                        + " "
                                        + Util.messageNumberToText(Util.MessageKind.CastPlayerIdleReason, idleReason));
                                lastIdleReason = idleReason;
                                lastPlayerState = playerState;
                                if (playerState == MediaStatus.PLAYER_STATE_IDLE && idleReason == IDLE_REASON_FINISHED) {
                                    Util.log(TAG, "Should be going to the next song after " + musicFile.Id);
                                    AudioPlayer.getInstance().next();
                                }
                            }
                        }
                    }
                }

                @Override
                public void onAdBreakStatusUpdated() {
                }

                @Override
                public void onMetadataUpdated() {
                }

                @Override
                public void onPreloadStatusUpdated() {
                }

                @Override
                public void onSendingRemoteMediaRequest() {

                }
            };

            mediaPlayer.registerCallback(mediaCallback);
        } catch (Exception e) {
            Util.error(TAG, e);
        }
    }

    @Override
    public void play(MusicFile musicFile, int seekPosition) {
        try {
            Util.log(TAG, "play " + musicFile.Id + " at position " + seekPosition);
            if (getCastSession() != null) {
                Util.log(TAG, "Cast session is not null " + getCastSession().getSessionId());
                setMediaListener(false, musicFile);
                MediaInfo mediaInfo = prepareMedia(musicFile);
                MediaLoadOptions mediaOptions = new MediaLoadOptions.Builder().setAutoplay(true).setPlayPosition(seekPosition).build();
                mediaPlayer.load(mediaInfo, mediaOptions);
            }
        } catch (Exception e) {
            Util.error(TAG, e);
        }
    }

    @Override
    public void stop() {
        Util.log(TAG, "stop");
        if (mediaPlayer != null) {
            mediaPlayer.stop();
        }
    }

    @Override
    public void pause() {
        Util.log(TAG, "pause");
        if (mediaPlayer != null) {
            mediaPlayer.pause();
        }
    }

    @Override
    public void seek(int position) {
        Util.log(TAG, "seek " + position);
        mediaPlayer.seek(
                new MediaSeekOptions.Builder()
                        .setPosition(position)
                        .setResumeState(RESUME_STATE_UNCHANGED)
                        .build()
        );
    }

    @Override
    public void resume(int position) {
        Util.log(TAG, "resume " + position);
        mediaPlayer.seek(
                new MediaSeekOptions.Builder()
                        .setPosition(position)
                        .setResumeState(RESUME_STATE_PLAY)
                        .build()
        );
    }

    public boolean isCasting() {
        Util.log(TAG, "isCasting is " + (getCastSession() != null));
        return getCastSession() != null;
    }

    @Override
    public Integer getCurrentPosition() {
        try {
            if (mediaPlayer != null && mediaPlayer.isPlaying()) {
                return (int) mediaPlayer.getApproximateStreamPosition();
            }
        } catch (Exception swallow) {
        }

        return null;
    }

    @Override
    public Integer getSongDuration() {
        if (mediaPlayer != null && mediaPlayer.isPlaying()) {
            return (int) mediaPlayer.getStreamDuration();
        }
        return null;
    }

    @Override
    public void destroy() {
        try {
            if (mediaPlayer != null) {
                mediaPlayer.stop();
            }
        } catch (Exception swallow) {
        }

        try {
            if (getSessionManager() != null) {
                getSessionManager().endCurrentSession(true);
            }
        } catch (Exception swallow) {
        }
    }
}
