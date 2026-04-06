package com.simplepathstudios.snowgloo.viewmodel;

import androidx.lifecycle.MutableLiveData;
import androidx.lifecycle.ViewModel;

import com.simplepathstudios.snowgloo.LoadingIndicator;
import com.simplepathstudios.snowgloo.Util;
import com.simplepathstudios.snowgloo.api.ApiClient;
import com.simplepathstudios.snowgloo.api.model.ArtistView;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class ArtistViewViewModel extends ViewModel {
    public MutableLiveData<ArtistView> Data;
    public ArtistViewViewModel(){
        Data = new MutableLiveData<ArtistView>();
    }


    public void load(String artist){
        LoadingIndicator.setLoading(true);
        ApiClient.getInstance().getArtistView(artist).enqueue(new Callback< ArtistView >(){

            @Override
            public void onResponse(Call<ArtistView> call, Response<ArtistView> response) {
                LoadingIndicator.setLoading(false);
                Data.setValue(response.body());
            }

            @Override
            public void onFailure(Call<ArtistView> call, Throwable t) {
                Util.error("ArtistListViewModel", t);
                LoadingIndicator.setLoading(false);
            }
        });
    }
}
