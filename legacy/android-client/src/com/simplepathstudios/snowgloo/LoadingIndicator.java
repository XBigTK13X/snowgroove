package com.simplepathstudios.snowgloo;

import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.widget.ProgressBar;

public class LoadingIndicator {
    private static final String TAG = "LoadingIndicator";
    private static boolean isLoading;
    private static ProgressBar progressBar;
    public static void setLoading(boolean status){
        new Handler(Looper.getMainLooper()).post(new Runnable(){
            @Override
            public void run() {
                isLoading = status;
                if(isLoading){
                    progressBar.setVisibility(View.VISIBLE);
                } else {
                    progressBar.setVisibility(View.INVISIBLE);
                }
            }
        });
    }

    public static void setProgressBar(ProgressBar progressBar) {
        LoadingIndicator.progressBar = progressBar;
    }
}
