package com.simplepathstudios.snowgloo.api.model;

import com.simplepathstudios.snowgloo.SnowglooSettings;
import com.simplepathstudios.snowgloo.Util;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;

public class MusicQueue {
    public static final String TAG = "MusicQueue";
    public static final MusicQueue EMPTY = new MusicQueue();

    private ArrayList<MusicFile> songs = new ArrayList<MusicFile>();
    private HashMap<String, Boolean> lookup = new HashMap<String, Boolean>();
    public Integer currentIndex = null;
    public UpdateReason updateReason = UpdateReason.SERVER_RELOAD;
    public PlayerState playerState;
    public String durationTimestamp;

    private transient HashMap<MusicId, Boolean> dedupeLookup = new HashMap<MusicId, Boolean>();

    public boolean isReady(){
        return songs != null;
    }

    public int getSize(){
        if(songs == null){
            return 0;
        }
        return songs.size();
    }

    private void updateDuration(){
        float durationSeconds = 0;
        for(MusicFile musicFile: songs){
            if(musicFile.AudioDuration != null){
                durationSeconds += musicFile.AudioDuration;
            }
        }
        durationTimestamp = Util.millisecondsToTimestamp(Math.round(1000f * durationSeconds));
    }

    public boolean add(MusicFile song){
        return add(song, null);
    }

    public boolean add(MusicFile song, Integer position){
        if(dedupeLookup.containsKey(song.getLookupId())){
            return false;
        }
        dedupeLookup.put(song.getLookupId(), true);
        lookup.put(song.Id, true);
        if(position == null){
            songs.add(song);
        } else {
            songs.add(position, song);
        }
        updateDuration();
        return true;
    }

    public void remove(int songIndex){
        MusicFile song = songs.get(songIndex);
        lookup.remove(song.Id);
        dedupeLookup.remove(song.getLookupId());
        songs.remove(songIndex);
        updateDuration();
    }

    public ArrayList<MusicFile> getAll(){
        return songs;
    }

    public MusicFile getSong(int index){
        return songs.get(index);
    }

    public MusicFile getCurrent(){
        if(songs == null || currentIndex == null || songs.size() == 0 || currentIndex == -1 || currentIndex > songs.size() - 1 || currentIndex < 0) {
            return MusicFile.EMPTY;
        }
        return songs.get(currentIndex);
    }

    public void shuffle(){
        Collections.shuffle(songs);
    }

    public enum PlayerState {
        PAUSED, PLAYING, IDLE
    }

    public enum UpdateReason{
        SHUFFLE, CLEAR, ITEM_ADDED, ITEM_MOVED, ITEM_REMOVED, SERVER_RELOAD, USER_CHANGED_CURRENT_INDEX, TRACK_CHANGED, SERVER_FIRST_LOAD, PLAYER_STATE_CHANGED, OUT_OF_TRACKS;
    }
}
