package com.simplepathstudios.snowgloo.viewmodel;

import androidx.lifecycle.MutableLiveData;
import androidx.lifecycle.ViewModel;

import com.simplepathstudios.snowgloo.Util;
import com.simplepathstudios.snowgloo.api.ApiClient;
import com.simplepathstudios.snowgloo.api.model.UserList;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class UserListViewModel extends ViewModel {
    public MutableLiveData<UserList> Data;
    public UserListViewModel(){
        Data = new MutableLiveData<UserList>();
    }

    public void load(){
        ApiClient.getInstance().getUserList().enqueue(new Callback< UserList >(){

            @Override
            public void onResponse(Call<UserList> call, Response<UserList> response) {
                Data.setValue(response.body());
            }

            @Override
            public void onFailure(Call<UserList> call, Throwable t) {
                Util.error("UserListViewModel",t);
            }
        });
    }
}
