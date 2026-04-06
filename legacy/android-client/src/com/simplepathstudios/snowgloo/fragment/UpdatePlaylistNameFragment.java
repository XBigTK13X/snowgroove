package com.simplepathstudios.snowgloo.fragment;

import android.app.AlertDialog;
import android.app.Dialog;
import android.content.DialogInterface;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;

import androidx.fragment.app.DialogFragment;

import com.simplepathstudios.snowgloo.MainActivity;
import com.simplepathstudios.snowgloo.R;
import com.simplepathstudios.snowgloo.Util;
import com.simplepathstudios.snowgloo.api.model.MusicPlaylist;
import com.simplepathstudios.snowgloo.viewmodel.ObservableMusicQueue;
import com.simplepathstudios.snowgloo.viewmodel.PlaylistViewViewModel;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class UpdatePlaylistNameFragment extends DialogFragment {
    private static final String TAG = "SaveQueueAsNewPlaylistFragment";

    private PlaylistViewViewModel viewModel;
    private LayoutInflater inflator;
    private AlertDialog alertDialog;
    public UpdatePlaylistNameFragment(LayoutInflater inflater, PlaylistViewViewModel playlistListViewModel){
        this.inflator = inflater;
        this.viewModel = playlistListViewModel;
    }

    @Override
    public Dialog onCreateDialog(Bundle savedInstanceState) {
        AlertDialog.Builder builder = new AlertDialog.Builder(getActivity());
        View dialogView = this.inflator.inflate(R.layout.save_queue_as_playlist_dialog, null);
        EditText playlistNameText = dialogView.findViewById(R.id.playlist_name);
        builder.setView(dialogView);
        builder.setTitle("Change playlist name?")
                .setPositiveButton("Save", new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int id) {
                        String playlistName = playlistNameText.getText().toString();
                        MusicPlaylist playlist = viewModel.Data.getValue();
                        Call savePlaylistCall = ObservableMusicQueue.getInstance().renamePlaylist(playlist, playlistName);
                        if(savePlaylistCall != null){
                            savePlaylistCall.enqueue(new Callback() {
                                @Override
                                public void onResponse(Call call, Response response) {
                                    viewModel.load(playlist.id);
                                    MainActivity.getInstance().refreshPlaylists();
                                }

                                @Override
                                public void onFailure(Call call, Throwable t) {
                                    Util.toast("Unable to save playlist");
                                    Util.log(TAG, "Unable to save playlist");
                                    Util.error(TAG, t);
                                }
                            });
                        }
                    }
                })
                .setNegativeButton("Cancel", new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int id) {

                    }
                });
        alertDialog = builder.create();
        alertDialog.setOnShowListener(new DialogInterface.OnShowListener() {
            @Override
            public void onShow(DialogInterface dialog) {
                alertDialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(false);
            }
        });
        playlistNameText.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                String playlistName = s.toString();
                boolean enable = playlistName.length() > 1;
                Button button = alertDialog.getButton(AlertDialog.BUTTON_POSITIVE);
                button.setEnabled(enable);
            }
            @Override
            public void afterTextChanged(Editable s) {}
        });
        return alertDialog;
    }
}