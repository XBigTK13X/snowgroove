package com.simplepathstudios.snowgloo;

import android.app.AlertDialog;
import android.content.Context;
import android.content.DialogInterface;
import android.media.MediaPlayer;
import android.util.Log;
import android.view.MenuItem;
import android.widget.Toast;

import com.simplepathstudios.snowgloo.api.ApiClient;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.text.SimpleDateFormat;
import java.util.Date;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

import static com.google.android.gms.cast.MediaStatus.IDLE_REASON_CANCELED;
import static com.google.android.gms.cast.MediaStatus.IDLE_REASON_ERROR;
import static com.google.android.gms.cast.MediaStatus.IDLE_REASON_FINISHED;
import static com.google.android.gms.cast.MediaStatus.IDLE_REASON_INTERRUPTED;
import static com.google.android.gms.cast.MediaStatus.IDLE_REASON_NONE;
import static com.google.android.gms.cast.MediaStatus.PLAYER_STATE_BUFFERING;
import static com.google.android.gms.cast.MediaStatus.PLAYER_STATE_IDLE;
import static com.google.android.gms.cast.MediaStatus.PLAYER_STATE_LOADING;
import static com.google.android.gms.cast.MediaStatus.PLAYER_STATE_PAUSED;
import static com.google.android.gms.cast.MediaStatus.PLAYER_STATE_PLAYING;
import static com.google.android.gms.cast.MediaStatus.PLAYER_STATE_UNKNOWN;

public class Util {
    private static final String TAG = "Util";

    private static Context __context;
    private static Thread.UncaughtExceptionHandler __androidExceptionHandler;

    public static void setGlobalContext(Context context){
        __context = context;
    }

    public static Context getGlobalContext(){
        if(__context == null){
            Log.d(TAG,"Global context is null, it must be set before it is read");
        }
        return __context;
    }

    private static int MILLISECONDS_PER_HOUR = 1000 * 60 * 60;
    private static int MILLISECONDS_PER_MINUTE = 1000 * 60;
    public static String millisecondsToTimestamp(int milliseconds){
        if(milliseconds >= MILLISECONDS_PER_HOUR){
            int hours = (milliseconds / (MILLISECONDS_PER_HOUR));
            int minutes = (milliseconds / (MILLISECONDS_PER_MINUTE)) % 60;
            int seconds = (milliseconds / 1000) % 60;
            return String.format("%02dh %02dm %02ds", hours, minutes, seconds);
        }
        int minutes = (milliseconds / (MILLISECONDS_PER_MINUTE)) % 60;
        int seconds = (milliseconds / 1000) % 60;
        return String.format("%02dm %02ds", minutes, seconds);
    }

    public static void error(String tag, Throwable e){
        StringWriter sw = new StringWriter();
        e.printStackTrace(new PrintWriter(sw));
        Util.log(tag, "Message: "+e.getMessage()+"\n StackTrace: " + sw.toString());
    }

    public static void log(String tag, String message){
        Util.log(tag, message, false);
    }

    public static void log(String tag, String message, boolean force){
        try{
            if(!SnowglooSettings.EnableDebugLog &&!force){
                return;
            }
            String timestamp = new SimpleDateFormat("yyyy/MM/dd HH:mm:ss").format(new Date());
            String logEntry = String.format("[SNOW] %s - %s - %s : %s",System.currentTimeMillis(), timestamp,tag,message);
            Log.d(tag, logEntry);
            if (ApiClient.getInstance().getCurrentUser() != null) {
                ApiClient.getInstance().log(logEntry).enqueue(new Callback() {
                    @Override
                    public void onResponse(Call call, Response response) { }
                    @Override
                    public void onFailure(Call call, Throwable t) {
                        Log.e(TAG, "[SNOW] Unable to send log",t);
                    }
                });
            }
        } catch(Exception e){
            Log.d(TAG, "[SNOW] An error occurred while logging",e);
        }

    }

    private static Toast lastToast;
    public static void toast(String message){
        if(lastToast != null){
            lastToast.cancel();
        }
        lastToast = Toast.makeText(getGlobalContext(), message, Toast.LENGTH_SHORT);
        lastToast.show();
    }

    public static void registerGlobalExceptionHandler() {
        if(__androidExceptionHandler == null){
            __androidExceptionHandler = Thread.getDefaultUncaughtExceptionHandler();

            Thread.setDefaultUncaughtExceptionHandler(
                    new Thread.UncaughtExceptionHandler() {
                        @Override
                        public void uncaughtException(
                                Thread paramThread,
                                Throwable paramThrowable
                        ) {
                            StringWriter stringWriter = new StringWriter();
                            PrintWriter printWriter = new PrintWriter(stringWriter);
                            paramThrowable.printStackTrace(printWriter);
                            String stackTrace = stringWriter.toString();
                            Util.log(TAG, "An error occurred " +paramThrowable.getMessage() +" => "+stackTrace, true);
                            if (__androidExceptionHandler != null)
                                __androidExceptionHandler.uncaughtException(
                                        paramThread,
                                        paramThrowable
                                ); //Delegates to Android's error handling
                            else
                                System.exit(2); //Prevents the service/app from freezing
                        }
                    });
        }
    }

    public static void confirmMenuAction(MenuItem menuItem, String message, DialogInterface.OnClickListener confirmListener){
        AlertDialog.Builder builder = new AlertDialog.Builder(MainActivity.getInstance());
        builder.setMessage(message);
        builder.setPositiveButton("Yes", confirmListener);
        builder.setNegativeButton("No", new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {

            }
        });
        menuItem.setOnMenuItemClickListener(new MenuItem.OnMenuItemClickListener() {
            @Override
            public boolean onMenuItemClick(MenuItem item) {
                AlertDialog dialog = builder.create();
                dialog.show();
                return false;
            }
        });
    }

    public enum MessageKind {
        CastPlayerState, CastPlayerIdleReason
    }

    public static String messageNumberToText(MessageKind messageKind, int messageCode){
        if(messageKind == MessageKind.CastPlayerState){
            switch(messageCode){
                case PLAYER_STATE_UNKNOWN:
                    return "PLAYER_STATE_UNKNOWN";
                case PLAYER_STATE_IDLE:
                    return "PLAYER_STATE_IDLE";
                case PLAYER_STATE_PLAYING:
                    return "PLAYER_STATE_PLAYING";
                case PLAYER_STATE_PAUSED:
                    return "PLAYER_STATE_PAUSED";
                case PLAYER_STATE_BUFFERING:
                    return "PLAYER_STATE_BUFFERING";
                case PLAYER_STATE_LOADING:
                    return "PLAYER_STATE_LOADING";
            }
        }
        if(messageKind == MessageKind.CastPlayerIdleReason){
            switch(messageCode){
                case IDLE_REASON_NONE:
                    return "IDLE_REASON_NONE";
                case IDLE_REASON_FINISHED:
                    return "IDLE_REASON_FINISHED";
                case IDLE_REASON_CANCELED:
                    return "IDLE_REASON_CANCELED";
                case IDLE_REASON_INTERRUPTED:
                    return "IDLE_REASON_INTERRUPTED";
                case IDLE_REASON_ERROR:
                    return "IDLE_REASON_ERROR";
            }
        }
        return "Unknown int "+ messageCode + " for messageKind "+messageKind.toString();
    }
}
