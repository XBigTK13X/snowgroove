package com.simplepathstudios.snowgloo.fragment;

import android.os.Bundle;
import android.text.TextUtils;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.lifecycle.Observer;

import com.simplepathstudios.snowgloo.MainActivity;
import com.simplepathstudios.snowgloo.R;
import com.simplepathstudios.snowgloo.api.model.MusicFile;
import com.simplepathstudios.snowgloo.api.model.MusicQueue;
import com.simplepathstudios.snowgloo.viewmodel.ObservableMusicQueue;

public class NowPlayingFragment extends Fragment {
    private static final String TAG = "NowPlayingFragment";

    private TextView songTitle;
    private TextView songAlbum;
    private TextView songArtist;
    private ImageView coverArt;

    public View onCreateView(LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.now_playing_fragment, container, false);
    }

    @Override
    public void onViewCreated(View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        songTitle = view.findViewById(R.id.song_title);
        songTitle.setSelected(true);
        songTitle.setEllipsize(TextUtils.TruncateAt.MARQUEE);
        songAlbum = view.findViewById(R.id.song_album);
        songAlbum.setSelected(true);
        songAlbum.setEllipsize(TextUtils.TruncateAt.MARQUEE);
        songArtist = view.findViewById(R.id.song_artist);
        songArtist.setSelected(true);
        songArtist.setEllipsize(TextUtils.TruncateAt.MARQUEE);
        coverArt = view.findViewById(R.id.cover_art);
        ObservableMusicQueue.getInstance().observe(new Observer<MusicQueue>() {
            @Override
            public void onChanged(MusicQueue musicQueue) {
                MusicFile currentSong = musicQueue.getCurrent();
                songTitle.setText(currentSong.Title);
                songAlbum.setText(currentSong.DisplayAlbum + " (" + currentSong.ReleaseYear + ")");
                songArtist.setText(currentSong.DisplayArtist);
                if (ObservableMusicQueue.getInstance().getCurrentAlbumArt() != null){
                    coverArt.setImageBitmap(ObservableMusicQueue.getInstance().getCurrentAlbumArt());
                }
            }
        });
        ObservableMusicQueue.getInstance().observe(new Observer<MusicQueue>() {
            @Override
            public void onChanged(MusicQueue musicQueue) {
                if(isVisible() && MainActivity.getInstance() != null && musicQueue != null){
                    String queueInfo = musicQueue.getSize() + " songs - " + musicQueue.durationTimestamp;
                    MainActivity.getInstance().setActionBarSubtitle(queueInfo);
                }
            }
        });
    }
}
