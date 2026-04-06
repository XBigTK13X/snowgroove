package com.simplepathstudios.snowgloo.viewmodel;

import androidx.lifecycle.MutableLiveData;
import androidx.lifecycle.ViewModel;

import com.simplepathstudios.snowgloo.LoadingIndicator;
import com.simplepathstudios.snowgloo.Util;
import com.simplepathstudios.snowgloo.api.ApiClient;
import com.simplepathstudios.snowgloo.api.model.AlbumList;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class AlbumListViewModel extends ViewModel {

    public MutableLiveData<AlbumList> Data;
    public AlbumListViewModel(){
        Data = new MutableLiveData<AlbumList>();
    }

    public void load(){
        LoadingIndicator.setLoading(true);
        ApiClient.getInstance().getAlbumList().enqueue(new Callback< AlbumList >(){

            @Override
            public void onResponse(Call<AlbumList> call, Response<AlbumList> response) {
                LoadingIndicator.setLoading(false);
                Data.setValue(response.body());
            }

            @Override
            public void onFailure(Call<AlbumList> call, Throwable t) {
                Util.error("AlbumListViewModel.load",t);
                LoadingIndicator.setLoading(false);
            }
        });
    }
}
