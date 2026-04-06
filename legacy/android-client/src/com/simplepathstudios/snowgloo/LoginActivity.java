package com.simplepathstudios.snowgloo;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;

import androidx.appcompat.app.AppCompatActivity;
import androidx.lifecycle.Observer;
import androidx.lifecycle.ViewModelProvider;

import com.simplepathstudios.snowgloo.api.ApiClient;
import com.simplepathstudios.snowgloo.viewmodel.ObservableCastContext;
import com.simplepathstudios.snowgloo.viewmodel.SettingsViewModel;
import com.simplepathstudios.snowgloo.viewmodel.UserListViewModel;

public class LoginActivity extends AppCompatActivity{

    private final String TAG = "LoginActivity";

    private SettingsViewModel settingsViewModel;
    private UserListViewModel userListViewModel;


    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Util.setGlobalContext(getApplicationContext());
        ObservableCastContext.getInstance().reconnect();
        this.settingsViewModel = new ViewModelProvider(this).get(SettingsViewModel.class);
        settingsViewModel.Data.observe(this, new Observer<SettingsViewModel.Settings>() {
            @Override
            public void onChanged(SettingsViewModel.Settings settings) {
                if(settings.Username != null){
                    Intent intent = new Intent(getApplicationContext(), MainActivity.class);
                    startActivity(intent);
                    finish();
                }
            }
        });
        this.settingsViewModel.initialize(this.getSharedPreferences("Snowgloo", Context.MODE_PRIVATE));
        SettingsViewModel.Settings settings = settingsViewModel.Data.getValue();
        ApiClient.retarget(settings.ServerUrl, settings.Username);
        this.userListViewModel = new ViewModelProvider(this).get(UserListViewModel.class);
        this.userListViewModel.load();
        setContentView(R.layout.login_activity);
    }


}