package com.simplepathstudios.snowgloo.viewmodel;

import androidx.lifecycle.MutableLiveData;
import androidx.lifecycle.ViewModel;

import com.simplepathstudios.snowgloo.LoadingIndicator;
import com.simplepathstudios.snowgloo.Util;
import com.simplepathstudios.snowgloo.api.ApiClient;
import com.simplepathstudios.snowgloo.api.model.MusicPlaylist;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class PlaylistViewViewModel extends ViewModel {
    public MutableLiveData<MusicPlaylist> Data;
    public PlaylistViewViewModel(){
        Data = new MutableLiveData<MusicPlaylist>();
    }

    public void load(String playlistId){
        LoadingIndicator.setLoading(true);
        ApiClient.getInstance().getPlaylist(playlistId).enqueue(new Callback< MusicPlaylist >(){
            @Override
            public void onResponse(Call<MusicPlaylist> call, Response<MusicPlaylist> response) {
                LoadingIndicator.setLoading(false);
                Data.setValue(response.body());
            }

            @Override
            public void onFailure(Call<MusicPlaylist> call, Throwable t) {
                Util.error("PlaylistViewModel.load",t);
                LoadingIndicator.setLoading(false);
            }
        });
    }
}
