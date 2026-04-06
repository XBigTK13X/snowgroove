package com.simplepathstudios.snowgloo.viewmodel;

import androidx.lifecycle.MutableLiveData;
import androidx.lifecycle.ViewModel;

import com.simplepathstudios.snowgloo.LoadingIndicator;
import com.simplepathstudios.snowgloo.Util;
import com.simplepathstudios.snowgloo.api.ApiClient;
import com.simplepathstudios.snowgloo.api.model.ArtistList;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class ArtistListViewModel extends ViewModel {
    public MutableLiveData<ArtistList> Data;
    public ArtistListViewModel(){
        Data = new MutableLiveData<ArtistList>();
    }

    public void load(String category){
        LoadingIndicator.setLoading(true);
        ApiClient.getInstance().getArtistList(category).enqueue(new Callback< ArtistList >(){

            @Override
            public void onResponse(Call<ArtistList> call, Response<ArtistList> response) {
                LoadingIndicator.setLoading(false);
                Data.setValue(response.body());
            }

            @Override
            public void onFailure(Call<ArtistList> call, Throwable t) {
                Util.error("ArtistListViewModel",t);
                LoadingIndicator.setLoading(false);
            }
        });
    }
}
