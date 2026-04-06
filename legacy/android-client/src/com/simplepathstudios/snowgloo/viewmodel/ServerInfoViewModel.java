package com.simplepathstudios.snowgloo.viewmodel;

import androidx.lifecycle.MutableLiveData;
import androidx.lifecycle.ViewModel;

import com.simplepathstudios.snowgloo.LoadingIndicator;
import com.simplepathstudios.snowgloo.Util;
import com.simplepathstudios.snowgloo.api.ApiClient;
import com.simplepathstudios.snowgloo.api.model.ServerInfo;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class ServerInfoViewModel extends ViewModel {
    public MutableLiveData<ServerInfo> Data;
    public MutableLiveData<String> Error;
    public ServerInfoViewModel(){
        Data = new MutableLiveData<>();
        Error = new MutableLiveData<>();
    }

    public void load() {
        ApiClient.getInstance().getServerInfo().enqueue(new Callback<ServerInfo>() {

            @Override
            public void onResponse(Call<ServerInfo> call, Response<ServerInfo> response) {
                LoadingIndicator.setLoading(false);
                Error.setValue(null);
                Data.setValue(response.body());
            }

            @Override
            public void onFailure(Call<ServerInfo> call, Throwable t) {
                LoadingIndicator.setLoading(false);
                Error.setValue("An error occurred while checking the server\n["+t.getMessage()+"]");
                Util.error("ServerInfoViewModel.load",t);
            }
        });
    }
}
