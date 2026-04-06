package com.simplepathstudios.snowgloo.viewmodel;

import android.graphics.Bitmap;
import android.graphics.drawable.Drawable;

import androidx.lifecycle.Observer;

import com.simplepathstudios.snowgloo.LoadingIndicator;
import com.simplepathstudios.snowgloo.SnowglooSettings;
import com.simplepathstudios.snowgloo.Util;
import com.simplepathstudios.snowgloo.api.ApiClient;
import com.simplepathstudios.snowgloo.api.model.MusicFile;
import com.simplepathstudios.snowgloo.api.model.MusicPlaylist;
import com.simplepathstudios.snowgloo.api.model.MusicQueue;
import com.simplepathstudios.snowgloo.api.model.MusicQueuePayload;
import com.squareup.picasso.Picasso;
import com.squareup.picasso.Target;

import java.util.ArrayList;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

import static com.simplepathstudios.snowgloo.api.model.MusicQueue.UpdateReason.PLAYER_STATE_CHANGED;

public class ObservableMusicQueue {
    public static String TAG = "ObservableMusicQueue";
    public enum RepeatMode{
        None,One,All
    }
    private static ObservableMusicQueue __instance;
    public static ObservableMusicQueue getInstance(){
        if(__instance == null){
            __instance = new ObservableMusicQueue();
        }
        return __instance;
    }

    private MusicQueue queue;
    private boolean firstLoad;
    private ArrayList<Observer<MusicQueue>> observers;
    private RepeatMode repeatMode;
    private Bitmap currentAlbumArt;


    private String preloadedCoverArtUrl = null;
    private Target coverArtTarget = new Target() {
        @Override
        public void onBitmapLoaded(Bitmap bitmap, Picasso.LoadedFrom from) {
            currentAlbumArt = bitmap;
            for(Observer<MusicQueue> observer: observers){
                observer.onChanged(queue);
            }
        }

        @Override
        public void onBitmapFailed(Exception e, Drawable errorDrawable) {

        }

        @Override
        public void onPrepareLoad(Drawable placeHolderDrawable) {
        }
    };

    public ObservableMusicQueue(){
        observers = new ArrayList<>();
        queue = MusicQueue.EMPTY;
        this.firstLoad = true;
        repeatMode = RepeatMode.None;
    }

    public boolean isLoaded(){
        return !firstLoad;
    }

    public void setRepeatMode(RepeatMode repeatMode) {
        repeatMode = repeatMode;
    }

    public void cycleRepeatMode(){
        switch (repeatMode){
            case None:
                repeatMode = RepeatMode.One;
                break;
            case One:
                repeatMode = RepeatMode.All;
                break;
            case All:
                repeatMode = RepeatMode.None;
                break;
        }
    }

    public RepeatMode getRepeatMode(){
        return repeatMode;
    }

    public void observe(Observer<MusicQueue> observer){
        observers.add(observer);
        observer.onChanged(queue);
    }

    public void load(){
        LoadingIndicator.setLoading(true);
        ApiClient.getInstance().getQueue().enqueue(new Callback< MusicQueue >(){
            @Override
            public void onResponse(Call<MusicQueue> call, Response<MusicQueue> response) {
                LoadingIndicator.setLoading(false);
                queue = response.body();
                if(firstLoad){
                    queue.updateReason = MusicQueue.UpdateReason.SERVER_FIRST_LOAD;
                    queue.playerState = MusicQueue.PlayerState.IDLE;
                } else {
                    queue.updateReason = MusicQueue.UpdateReason.SERVER_RELOAD;
                }

                firstLoad = false;
                notifyObservers(false);
            }

            @Override
            public void onFailure(Call<MusicQueue> call, Throwable t) {
                LoadingIndicator.setLoading(false);
                Util.log(TAG, "Unable to load the queue");
                Util.error(TAG, t);
            }
        });
    }

    private void save(){
        ApiClient.getInstance().setQueue(queue).enqueue(new Callback< MusicQueuePayload >(){
            @Override
            public void onResponse(Call<MusicQueuePayload> call, Response<MusicQueuePayload> response) {
                LoadingIndicator.setLoading(false);
            }

            @Override
            public void onFailure(Call<MusicQueuePayload> call, Throwable t) {
                LoadingIndicator.setLoading(false);
                Util.log(TAG, "Unable to save the queue");
                Util.error(TAG, t);
            }
        });
    }

    public void clear(){
        LoadingIndicator.setLoading(true);
        ApiClient.getInstance().clearQueue().enqueue(new Callback<MusicQueue>(){
            @Override
            public void onResponse(Call<MusicQueue> call, Response<MusicQueue> response) {
                queue = response.body();
                queue.updateReason = MusicQueue.UpdateReason.CLEAR;
                queue.playerState = MusicQueue.PlayerState.IDLE;
                notifyObservers();
                LoadingIndicator.setLoading(false);
            }

            @Override
            public void onFailure(Call<MusicQueue> call, Throwable t) {
                LoadingIndicator.setLoading(false);
                Util.log(TAG, "Unable to clear the queue");
                Util.error(TAG, t);
            }
        });
    }

    public boolean previousIndex(){
        boolean result = true;
        if(queue.currentIndex != null){
            if(repeatMode != RepeatMode.One){
                queue.currentIndex -= 1;
                queue.updateReason = MusicQueue.UpdateReason.TRACK_CHANGED;
                if(queue.currentIndex < 0){
                    if(repeatMode == RepeatMode.All){
                        queue.currentIndex = queue.getSize() - 1;
                    }
                    else {
                        queue.currentIndex = null;
                        queue.updateReason = MusicQueue.UpdateReason.OUT_OF_TRACKS;
                        result = false;
                    }
                }
            }
        } else {
            result = false;
        }
        notifyObservers();
        return result;
    }

    public boolean nextIndex(){
        boolean result = true;
        if(queue.isReady() && queue.currentIndex != null){
            if(repeatMode != RepeatMode.One) {
                queue.currentIndex += 1;
                queue.updateReason = MusicQueue.UpdateReason.TRACK_CHANGED;
                if (queue.currentIndex > queue.getSize() - 1) {
                    if (repeatMode == RepeatMode.All) {
                        queue.currentIndex = 0;
                    } else {
                        queue.currentIndex = null;
                        queue.updateReason = MusicQueue.UpdateReason.OUT_OF_TRACKS;
                        result = false;
                    }
                }
            }
        }
        if(queue.currentIndex == null){
            result = false;
        }
        notifyObservers();
        return result;
    }

    public void setCurrentIndex(Integer currentIndex){
        if(queue.currentIndex != null && queue.currentIndex == currentIndex){
            return;
        }
        queue.currentIndex = currentIndex;
        queue.updateReason = MusicQueue.UpdateReason.USER_CHANGED_CURRENT_INDEX;
        notifyObservers();
    }

    public Integer getIndex(String songId){
        for(int ii = 0 ; ii < queue.getSize(); ii++){
            if(queue.getSong(ii).Id.equals(songId)){
                return ii;
            }
        }
        return null;
    }

    public Integer getIndex(MusicFile musicFile){
        return getIndex(musicFile.Id);
    }

    public void removeItem(int position){
        queue.remove(position);
        if(queue.currentIndex != null){
            if(position < queue.currentIndex){
                queue.currentIndex--;
            }else {
                if(position == queue.currentIndex){
                    queue.currentIndex = null;
                }
            }
        }
        queue.updateReason = MusicQueue.UpdateReason.ITEM_REMOVED;
        notifyObservers();
    }

    public void moveItem(MusicFile item, int fromPosition, int toPosition) {
        if(fromPosition != toPosition && toPosition < queue.getSize()){
            queue.remove(fromPosition);
            queue.add(item, toPosition);
            if(queue.currentIndex != null){
                if(queue.currentIndex == fromPosition){
                    queue.currentIndex = toPosition;
                } else{
                    if(queue.currentIndex > fromPosition && queue.currentIndex <= toPosition){
                        queue.currentIndex--;
                    }
                    if(queue.currentIndex < fromPosition && queue.currentIndex >= toPosition){
                        queue.currentIndex++;
                    }
                }
            }
            queue.updateReason = MusicQueue.UpdateReason.ITEM_MOVED;
            notifyObservers();
        }
    }

    public void addItems(ArrayList<MusicFile> items){
        if(items == null){
            return ;
        }
        int foundCount = 0;
        for(MusicFile item : items){
            if(item.AudioDuration != null && item.AudioDuration <= SnowglooSettings.SongDurationMinimumSeconds){
                foundCount += 1;
                continue;
            }
            foundCount += queue.add(item) ? 0 : 1;
        }

        queue.updateReason = MusicQueue.UpdateReason.ITEM_ADDED;
        queue.currentIndex = queue.currentIndex == null ? queue.getSize() - items.size():queue.currentIndex;
        notifyObservers();
        if(foundCount == 0){
            Util.toast("All " + items.size() + " songs added to queue.");
        }
        else if(foundCount == items.size()) {
            Util.toast("No songs added, they were already queued up or too short");
        }
        else {
            Util.toast("Added " + (items.size() - foundCount) + " new songs that were long enough to play");
        }
    }

    public void addItem(MusicFile item){
        if (item == null) {
            return;
        }
        if(queue.add(item)) {
            queue.updateReason = MusicQueue.UpdateReason.ITEM_ADDED;
            queue.currentIndex = queue.currentIndex == null ? queue.getSize() - 1 : queue.currentIndex;
            notifyObservers();
            Util.toast("Added to the queue.");
        } else {
            Util.toast("Not added to queue because it is already there.");
        }
    }

    public void shuffle(){
        LoadingIndicator.setLoading(true);
        queue.currentIndex = 0;
        queue.shuffle();
        queue.playerState = MusicQueue.PlayerState.IDLE;
        queue.updateReason = MusicQueue.UpdateReason.SHUFFLE;
        notifyObservers();
    }

    public void setPlayerState(MusicQueue.PlayerState playerState){
        if(queue.playerState != playerState){
            queue.playerState = playerState;
            queue.updateReason = PLAYER_STATE_CHANGED;
            notifyObservers(false);
        }
    }

    public MusicQueue getQueue(){
        return queue;
    }

    private void notifyObservers(){
        notifyObservers(true);
    }

    private void notifyObservers(boolean persistChanges){
        if(persistChanges){
            save();
        }
        MusicFile currentSong = queue.getCurrent();
        if(currentSong != null){
            if(currentSong.CoverArt != null && !currentSong.CoverArt.isEmpty()){
                if(preloadedCoverArtUrl != currentSong.CoverArt){
                    preloadedCoverArtUrl = currentSong.CoverArt;
                    Picasso.get().load(currentSong.CoverArt).into(coverArtTarget);
                }
            }
        }
        for(Observer<MusicQueue> observer: observers) {
            observer.onChanged(queue);
        }
    }

    public Call saveQueueAsPlaylist(String playlistName) {
        return updatePlaylistFromQueue(null, playlistName);
    }

    public Call updatePlaylistFromQueue(String playlistId, String playlistName){
        if(queue.getSize() > 0 || playlistId == null){
            MusicPlaylist playlist = new MusicPlaylist();
            playlist.name = playlistName;
            playlist.id = playlistId;
            playlist.songs = queue.getAll();
            return ApiClient.getInstance().savePlaylist(playlist);
        } else {
            Util.toast("Unable to update existing playlist when the queue is empty.");
        }
        return null;
    }

    public Call renamePlaylist(MusicPlaylist playlist, String newName){
        playlist.name = newName;
        return ApiClient.getInstance().savePlaylist(playlist);
    }

    public Bitmap getCurrentAlbumArt(){
        return currentAlbumArt;
    }
}
