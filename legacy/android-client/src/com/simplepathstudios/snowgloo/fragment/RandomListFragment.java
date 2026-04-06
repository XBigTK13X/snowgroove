package com.simplepathstudios.snowgloo.fragment;

import android.content.DialogInterface;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.Menu;
import android.view.MenuInflater;
import android.view.MenuItem;
import android.view.View;
import android.view.ViewGroup;

import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.lifecycle.Observer;
import androidx.lifecycle.ViewModelProvider;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.simplepathstudios.snowgloo.MainActivity;
import com.simplepathstudios.snowgloo.R;
import com.simplepathstudios.snowgloo.Util;
import com.simplepathstudios.snowgloo.adapter.SongAdapter;
import com.simplepathstudios.snowgloo.api.model.MusicPlaylist;
import com.simplepathstudios.snowgloo.viewmodel.ObservableMusicQueue;
import com.simplepathstudios.snowgloo.viewmodel.RandomListViewModel;

public class RandomListFragment extends Fragment {
    private final String TAG = "PlaylistViewFragment";

    private ObservableMusicQueue observableMusicQueue;
    private RandomListViewModel randomListViewModel;
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
        inflater.inflate(R.menu.random_list_action_menu, menu);
        addToQueueButton = menu.findItem(R.id.add_to_queue_button);
    }

    @Override
    public View onCreateView(LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        MainActivity.getInstance().setActionBarTitle("Random Playlist");
        MainActivity.getInstance().setActionBarSubtitle("");
        return inflater.inflate(R.layout.random_list_fragment, container, false);
    }

    @Override
    public void onViewCreated(View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        observableMusicQueue = ObservableMusicQueue.getInstance();
        listElement = view.findViewById(R.id.playlist_songs);
        adapter = new SongAdapter();
        listElement.setAdapter(adapter);
        layoutManager = new LinearLayoutManager(getActivity());
        listElement.setLayoutManager(layoutManager);
        randomListViewModel = new ViewModelProvider(this).get(RandomListViewModel.class);
        randomListViewModel.Data.observe(getViewLifecycleOwner(), new Observer<MusicPlaylist>() {
            @Override
            public void onChanged(MusicPlaylist playlist) {
                Util.confirmMenuAction(addToQueueButton, "Add " + playlist.songs.size() + " songs to queue?", new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        observableMusicQueue.addItems(playlist.songs);
                    }
                });
                adapter.setData(playlist.songs);
                listElement.setAdapter(adapter);
            }
        });
        randomListViewModel.load();
    }
}
