package com.simplepathstudios.snowgloo.audio;

import com.google.android.exoplayer2.DefaultRenderersFactory;
import com.google.android.exoplayer2.ExoPlayer;
import com.google.android.exoplayer2.MediaItem;
import com.google.android.exoplayer2.PlaybackException;
import com.google.android.exoplayer2.Player;
import com.simplepathstudios.snowgloo.MainActivity;
import com.simplepathstudios.snowgloo.Util;
import com.simplepathstudios.snowgloo.api.model.MusicFile;

public class LocalPlayer implements IAudioPlayer {
    private static final String TAG = "LocalPlayer";
    private ExoPlayer mediaPlayer;
    private MusicFile currentSong;
    private int currentSeekPosition;
    private int lastPosition;
    private double lastVolume;

    public LocalPlayer(){
    }

    @Override
    public boolean isPlaying(){
        if(mediaPlayer != null){
            return mediaPlayer.isPlaying();
        }
        return false;
    }

    @Override
    public void setVolume(double volume) {
        if(mediaPlayer != null){
            mediaPlayer.setVolume((float)volume);
        }
        lastVolume = volume;
    }

    @Override
    public void play(MusicFile musicFile, int seekPosition) {
        currentSong = musicFile;
        currentSeekPosition = seekPosition;
        if(mediaPlayer != null) {
            mediaPlayer.release();
        }
        try {
            //TODO This seems inefficient.
            // At first I was reusing one mediaPlayer instance per play,
            // but the end player event triggered a double skip when a user hit next
            // That could be solved by letting the audioplayer wrapper lock the event handler
            // but I didn't want to leak those details when I first swapped in the exoplayer.

            DefaultRenderersFactory factory = new DefaultRenderersFactory(MainActivity.getInstance())
                    .setEnableAudioOffload(true);
            mediaPlayer = new ExoPlayer.Builder(MainActivity.getInstance())
                    .setRenderersFactory(factory)
                    .build();
            mediaPlayer.experimentalSetOffloadSchedulingEnabled(true);
            mediaPlayer.addListener(new Player.Listener(){
                @Override
                public void onPlayerError(PlaybackException error) {
                    Util.error(TAG, error);
                }
                @Override
                public void onPlaybackStateChanged(@Player.State int state){
                    if(state == Player.STATE_ENDED){
                        Util.log(TAG,"trying to play what comes after " + currentSong.Id);
                        AudioPlayer.getInstance().next();
                    }
                }
            });
            mediaPlayer.setRepeatMode(Player.REPEAT_MODE_OFF);
            Util.log(TAG,"started playback from local player setup for "+currentSong.Id);
        } catch (Exception e) {
            Util.error(TAG,e);
        }
        if(currentSong != null){
            try{
                if(mediaPlayer.getMediaItemCount() > 0){
                    mediaPlayer.removeMediaItems(0,mediaPlayer.getMediaItemCount());
                }
                MediaItem mediaItem = new MediaItem.Builder()
                    .setUri(currentSong.AudioUrl)
                    .setMediaId(currentSong.Id)
                    .build();


                mediaPlayer.addMediaItem(mediaItem);
                mediaPlayer.setVolume((float)lastVolume);
                mediaPlayer.seekTo(currentSeekPosition);
                mediaPlayer.prepare();
                mediaPlayer.play();
            } catch(Exception e){
                Util.error(TAG,e);
            }
        }
    }

    @Override
    public void stop() {
        if(mediaPlayer != null){
            mediaPlayer.stop();
        }
    }

    @Override
    public void pause() {
        if(mediaPlayer != null && mediaPlayer.isPlaying()){
            mediaPlayer.pause();
        }

    }

    @Override
    public void seek(int position) {
        if(mediaPlayer != null){
            mediaPlayer.seekTo(position);
        }
    }

    @Override
    public void resume(int position) {
        if(position == lastPosition){
            mediaPlayer.play();
        }
        else {
            this.play(currentSong, position);
        }
    }

    @Override
    public Integer getCurrentPosition() {
        try{
            if(mediaPlayer != null){
                lastPosition = (int)mediaPlayer.getCurrentPosition();
                return lastPosition;
            }
        } catch(Exception swallow){

        }
        return null;
    }

    @Override
    public Integer getSongDuration(){
        if(mediaPlayer != null){
            return (int)mediaPlayer.getDuration();
        }
        return null;
    }

    @Override
    public void destroy() {
        try{
            mediaPlayer.stop();
        } catch(Exception swallow){}
        try{
            mediaPlayer.release();
            mediaPlayer = null;
        }
        catch(Exception swallow){}
    }
}
