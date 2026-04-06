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

public class RandomListViewModel extends ViewModel {
    public MutableLiveData<MusicPlaylist> Data;
    public RandomListViewModel(){
        Data = new MutableLiveData<MusicPlaylist>();
    }

    public void load(){
        LoadingIndicator.setLoading(true);
        ApiClient.getInstance().getRandomList().enqueue(new Callback< MusicPlaylist >(){
            @Override
            public void onResponse(Call<MusicPlaylist> call, Response<MusicPlaylist> response) {
                LoadingIndicator.setLoading(false);
                Data.setValue(response.body());
            }

            @Override
            public void onFailure(Call<MusicPlaylist> call, Throwable t) {
                Util.error("RandomListViewModel.load",t);
                LoadingIndicator.setLoading(false);
            }
        });
    }
}
