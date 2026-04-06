package com.simplepathstudios.snowgloo.fragment;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.Menu;
import android.view.MenuInflater;
import android.view.MenuItem;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.lifecycle.Observer;
import androidx.lifecycle.ViewModelProvider;
import androidx.navigation.NavController;
import androidx.navigation.Navigation;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.simplepathstudios.snowgloo.R;
import com.simplepathstudios.snowgloo.adapter.PlaylistAdapter;
import com.simplepathstudios.snowgloo.api.model.MusicPlaylistListItem;
import com.simplepathstudios.snowgloo.api.model.PlaylistList;
import com.simplepathstudios.snowgloo.viewmodel.PlaylistListViewModel;

public class PlaylistListFragment extends Fragment {
    private final String TAG = "PlaylistListFragment";
    private RecyclerView listElement;
    private PlaylistAdapter adapter;
    private LinearLayoutManager layoutManager;
    private PlaylistListViewModel viewModel;
    private MenuItem createPlaylistButton;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setHasOptionsMenu(true);
    }

    @Override
    public void onCreateOptionsMenu(Menu menu, MenuInflater inflater) {
        super.onCreateOptionsMenu(menu, inflater);

        inflater.inflate(R.menu.playlist_list_action_menu, menu);

        createPlaylistButton = menu.findItem(R.id.create_playlist_button);
        createPlaylistButton.setOnMenuItemClickListener(new MenuItem.OnMenuItemClickListener() {
            @Override
            public boolean onMenuItemClick(MenuItem item) {
                SaveQueueAsNewPlaylistFragment dialogFragment = new SaveQueueAsNewPlaylistFragment(getLayoutInflater(), viewModel);
                dialogFragment.show(getChildFragmentManager(),"save-queue-as-playlist-dialog");
                return false;
            }
        });
    }


    @Override
    public View onCreateView(LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.playlist_list_fragment, container, false);
    }

    @Override
    public void onViewCreated(View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        listElement = view.findViewById(R.id.playlist_list);
        adapter = new PlaylistAdapter();
        listElement.setAdapter(adapter);
        layoutManager = new LinearLayoutManager(getActivity());
        listElement.setLayoutManager(layoutManager);
        viewModel = new ViewModelProvider(this).get(PlaylistListViewModel.class);
        viewModel.Data.observe(getViewLifecycleOwner(), new Observer<PlaylistList>() {
            @Override
            public void onChanged(PlaylistList playlistList) {
                adapter.setData(playlistList);
                adapter.notifyDataSetChanged();
            }
        });
        viewModel.load();
    }
}
