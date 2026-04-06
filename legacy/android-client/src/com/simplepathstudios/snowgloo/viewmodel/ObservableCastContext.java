package com.simplepathstudios.snowgloo.viewmodel;

import androidx.lifecycle.Observer;

import com.google.android.gms.cast.framework.CastContext;
import com.simplepathstudios.snowgloo.Util;

import java.util.ArrayList;
import java.util.concurrent.Executors;

public class ObservableCastContext {
    private static String TAG = "ObservableCastContext";
    private static ObservableCastContext __instance;
    public static ObservableCastContext getInstance(){
        if(__instance == null){
            __instance = new ObservableCastContext();
        }
        return __instance;
    }

    private final int MaxConnectRetry = 5;
    private int retryCount;
    private CastContext castContext;
    private ArrayList<Observer<CastContext>> observers;

    private ObservableCastContext(){
        observers = new ArrayList<>();
    }

    private void setCastContext(){
        // If this is done too late, then the client will fail to discover receivers

        // See https://issuetracker.google.com/issues/229000935
        //Older SDK logic
        //castContext = CastContext.getSharedInstance(Util.getGlobalContext());
        //Newer SDK logic
        CastContext.getSharedInstance(Util.getGlobalContext(), Executors.newSingleThreadExecutor())
                .addOnSuccessListener(c -> {
                    Util.log(TAG, "Cast context obtained");
                    castContext = c;
                    notifyObservers();
                })
                .addOnFailureListener(e -> {
                    Util.error(TAG, e);
                    if(retryCount > 0){
                        retryCount--;
                        setCastContext();
                    } else {
                        Util.log(TAG, "Unable to obtain a cast context");
                    }
                });
    }

    public void reconnect(){
        retryCount = MaxConnectRetry;
        setCastContext();
    }

    private void notifyObservers(){
        for(Observer<CastContext> observer: observers) {
            observer.onChanged(castContext);
        }
    }

    public void observe(Observer<CastContext> observer){
        observers.add(observer);
        observer.onChanged(castContext);
    }
}

