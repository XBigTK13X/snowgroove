package com.simplepathstudios.snowgloo.fragment;

import android.content.DialogInterface;
import android.os.Bundle;
import android.view.ContextMenu;
import android.view.LayoutInflater;
import android.view.Menu;
import android.view.MenuInflater;
import android.view.MenuItem;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.fragment.app.Fragment;
import androidx.lifecycle.Observer;
import androidx.lifecycle.ViewModelProvider;
import androidx.navigation.NavController;
import androidx.navigation.Navigation;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.simplepathstudios.snowgloo.MainActivity;
import com.simplepathstudios.snowgloo.R;
import com.simplepathstudios.snowgloo.Util;
import com.simplepathstudios.snowgloo.adapter.SongAdapter;
import com.simplepathstudios.snowgloo.api.model.AlbumView;
import com.simplepathstudios.snowgloo.api.model.MusicAlbum;
import com.simplepathstudios.snowgloo.api.model.MusicFile;
import com.simplepathstudios.snowgloo.viewmodel.AlbumViewViewModel;
import com.simplepathstudios.snowgloo.viewmodel.ObservableMusicQueue;

public class AlbumViewFragment extends Fragment {
    private final String TAG = "AlbumViewFragment";

    private ObservableMusicQueue observableMusicQueue;
    private AlbumViewViewModel albumViewModel;
    private String albumSlug;
    private String albumDisplay;
    private RecyclerView listElement;
    private SongAdapter adapter;
    private LinearLayoutManager layoutManager;
    private MenuItem addToQueueButton;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setHasOptionsMenu(true);
    }

    @Override
    public void onCreateOptionsMenu(Menu menu, MenuInflater inflater) {
        super.onCreateOptionsMenu(menu, inflater);

        inflater.inflate(R.menu.add_to_queue_action_menu, menu);
        addToQueueButton = menu.findItem(R.id.add_to_queue_button);
        Util.confirmMenuAction(addToQueueButton, "Add album to queue?", new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                observableMusicQueue.addItems(albumViewModel.Data.getValue().album.Songs);
            }
        });
    }

    @Override
    public View onCreateView(LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        albumSlug = getArguments().getString("AlbumSlug");
        albumDisplay = getArguments().getString("AlbumDisplay");
        MainActivity.getInstance().setActionBarTitle(albumDisplay);
        MainActivity.getInstance().setActionBarSubtitle("Album");
        return inflater.inflate(R.layout.album_view_fragment, container, false);
    }

    @Override
    public void onViewCreated(View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        observableMusicQueue = ObservableMusicQueue.getInstance();
        listElement = view.findViewById(R.id.album_songs);
        adapter = new SongAdapter();
        listElement.setAdapter(adapter);
        layoutManager = new LinearLayoutManager(getActivity());
        listElement.setLayoutManager(layoutManager);
        albumViewModel = new ViewModelProvider(this).get(AlbumViewViewModel.class);
        albumViewModel.Data.observe(getViewLifecycleOwner(), new Observer<AlbumView>() {
            @Override
            public void onChanged(AlbumView album) {
                if(isVisible() && MainActivity.getInstance() != null) {
                    MainActivity.getInstance().setActionBarSubtitle("Album - " + album.album.ReleaseYear + " - [" + album.album.Songs.size() + " songs]");
                }
                adapter.setData(album.album.Songs);
                adapter.notifyDataSetChanged();
            }
        });
        albumViewModel.load(albumSlug);
    }
}
