package com.simplepathstudios.snowgloo.viewmodel;

import android.content.SharedPreferences;

import androidx.lifecycle.MutableLiveData;
import androidx.lifecycle.ViewModel;

import com.simplepathstudios.snowgloo.SnowglooSettings;

public class SettingsViewModel extends ViewModel {
    public MutableLiveData<Settings> Data;
    public SettingsViewModel(){
        Data = new MutableLiveData<>();
    }

    public void initialize(SharedPreferences preferences){
        Settings settings = new Settings();
        settings.Preferences = preferences;
        settings.Username = settings.Preferences.getString("Username",null);
        settings.ServerUrl = settings.Preferences.getString("ServerUrl", SnowglooSettings.ProdServerUrl);
        settings.EnableDebugLog = settings.Preferences.getBoolean("EnableDebugLog", false);
        settings.InternalMediaVolume = settings.Preferences.getFloat("InternalMediaVolume", 1.0f);
        settings.EnableSimpleUIMode = settings.Preferences.getBoolean("EnableSimpleUIMode", false);
        SnowglooSettings.EnableDebugLog = settings.EnableDebugLog;
        SnowglooSettings.InternalMediaVolume = settings.InternalMediaVolume;
        Data.setValue(settings);
    }

    public void setUsername(String username){
        Settings settings = Data.getValue();
        settings.Username = username;
        SharedPreferences.Editor editor = settings.Preferences.edit();
        editor.putString("Username", username);
        editor.commit();
        Data.setValue(settings);
    }

    public void setServerUrl(String serverUrl){
        Settings settings = Data.getValue();
        settings.ServerUrl = serverUrl;
        SharedPreferences.Editor editor = settings.Preferences.edit();
        editor.putString("ServerUrl", serverUrl);
        editor.commit();
        Data.setValue(settings);
    }

    public void setDebugLog(boolean enabled){
        Settings settings = Data.getValue();
        settings.EnableDebugLog = enabled;
        SharedPreferences.Editor editor = settings.Preferences.edit();
        editor.putBoolean("EnableDebugLog", enabled);
        editor.commit();
        Data.setValue(settings);
        SnowglooSettings.EnableDebugLog = settings.EnableDebugLog;
    }

    public void setInternalMediaVolume(double volume){
        Settings settings = Data.getValue();
        settings.InternalMediaVolume = (float)volume;
        SharedPreferences.Editor editor = settings.Preferences.edit();
        editor.putFloat("InternalMediaVolume", (float)volume);
        editor.commit();
        Data.setValue(settings);
        SnowglooSettings.InternalMediaVolume = settings.InternalMediaVolume;
    }

    public void setSimpleUIMode(boolean enabled){
        Settings settings = Data.getValue();
        settings.EnableSimpleUIMode = enabled;
        SharedPreferences.Editor editor = settings.Preferences.edit();
        editor.putBoolean("EnableSimpleUIMode", enabled);
        editor.commit();
        Data.setValue(settings);
        SnowglooSettings.EnableSimpleUIMode = settings.EnableSimpleUIMode;
    }

    public class Settings {
        public String Username;
        public String ServerUrl;
        public SharedPreferences Preferences;
        public boolean EnableDebugLog;
        public double InternalMediaVolume;
        public boolean EnableSimpleUIMode;
    }
}
