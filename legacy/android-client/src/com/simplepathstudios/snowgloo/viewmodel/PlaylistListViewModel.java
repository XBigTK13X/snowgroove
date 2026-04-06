package com.simplepathstudios.snowgloo.viewmodel;

import androidx.lifecycle.MutableLiveData;
import androidx.lifecycle.ViewModel;

import com.simplepathstudios.snowgloo.LoadingIndicator;
import com.simplepathstudios.snowgloo.Util;
import com.simplepathstudios.snowgloo.api.ApiClient;
import com.simplepathstudios.snowgloo.api.model.PlaylistList;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class PlaylistListViewModel extends ViewModel {
    public MutableLiveData<PlaylistList> Data;
    public PlaylistListViewModel(){
        Data = new MutableLiveData<PlaylistList>();
    }

    public void load(){
        LoadingIndicator.setLoading(true);
        ApiClient.getInstance().getPlaylists().enqueue(new Callback< PlaylistList >(){

            @Override
            public void onResponse(Call<PlaylistList> call, Response<PlaylistList> response) {
                LoadingIndicator.setLoading(false);
                Data.setValue(response.body());
            }

            @Override
            public void onFailure(Call<PlaylistList> call, Throwable t) {
                Util.error("PlaylistListViewModel.load",t);
                LoadingIndicator.setLoading(false);
            }
        });
    }
}
