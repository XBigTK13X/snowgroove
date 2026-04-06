package com.simplepathstudios.snowgloo.api;

import android.provider.Settings;
import android.util.Log;

import com.simplepathstudios.snowgloo.Util;
import com.simplepathstudios.snowgloo.api.model.AddToPlaylistPayload;
import com.simplepathstudios.snowgloo.api.model.AdminLog;
import com.simplepathstudios.snowgloo.api.model.MusicId;
import com.simplepathstudios.snowgloo.api.model.MusicPlaylist;
import com.simplepathstudios.snowgloo.api.model.MusicQueue;
import com.simplepathstudios.snowgloo.api.model.MusicQueuePayload;
import com.simplepathstudios.snowgloo.api.model.PlaylistPayload;

import retrofit2.Call;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;

public class ApiClient {
    private static final String TAG = "ApiClient";
    private static ApiClient __instance;
    public static ApiClient getInstance(){
        if(__instance == null){
            Log.e("ApiClient", "ApiClient is not ready");
        }
        return __instance;
    }

    public static void retarget(String serverUrl, String username){
        __instance = new ApiClient(serverUrl, username);
    }

    private ApiService httpClient;
    private String username;
    private String clientId;
    private ApiClient(String serverUrl, String username){
        Retrofit retrofit = new Retrofit.Builder()
                .baseUrl(serverUrl)
                .addConverterFactory(GsonConverterFactory.create())
                .build();
        this.username = username;
        this.httpClient = retrofit.create(ApiService.class);
        if(username != null && !username.isEmpty()){
            this.clientId = String.format("%s - %s - %s",
                    Settings.Secure.getString(Util.getGlobalContext().getContentResolver(),Settings.Secure.ANDROID_ID),
                    android.os.Build.MODEL,
                    username
            );
            Log.d(TAG, "Communicating with the server using clientId "+this.clientId);
        }
    }

    public String getCurrentUser(){
        return username;
    }

    public Call getQueue(){
        return this.httpClient.getQueue(this.username);
    }

    public Call setQueue(MusicQueue queue){
        MusicQueuePayload payload = new MusicQueuePayload();
        payload.queue = queue;
        return this.httpClient.setQueue(this.username, payload);
    }

    public Call getArtistList(String category){
        return this.httpClient.getArtistList(category);
    }

    public Call getArtistView(String artist){
        return this.httpClient.getArtist(artist);
    }

    public Call getAlbumView(String albumSlug){
        return this.httpClient.getAlbum(albumSlug);
    }

    public Call getAlbumList(){
        return this.httpClient.getAlbumList();
    }

    public Call getUserList(){
        return this.httpClient.getUserList();
    }

    public Call getServerInfo(){
        return this.httpClient.getServerInfo();
    }

    public Call search(String query){
        return this.httpClient.search(query);
    }

    public Call clearQueue(){
        return this.httpClient.clearQueue(this.username);
    }

    public Call getPlaylist(String playlistId){
        return this.httpClient.getPlaylist(playlistId);
    }

    public Call getPlaylists(){
        return this.httpClient.getPlaylists();
    }

    public Call addToPlaylist(String playlistId, String songId){
        AddToPlaylistPayload payload = new AddToPlaylistPayload();
        payload.songId = songId;
        payload.playlistId = playlistId;
        return this.httpClient.addToPlaylist(payload);
    }

    public Call log(String message){
        return this.httpClient.writeLog(new AdminLog(message, clientId));
    }

    public Call savePlaylist(MusicPlaylist playlist) {
        PlaylistPayload playlistPayload = new PlaylistPayload();
        playlistPayload.playlist = playlist;
        return this.httpClient.savePlaylist(playlistPayload);
    }

    public Call getRandomList(){
        return this.httpClient.getRandomList();
    }

    public Call getCategoryList(){
        return this.httpClient.getCategoryList();
    }
}
