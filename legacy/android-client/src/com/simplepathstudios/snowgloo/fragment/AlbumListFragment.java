package com.simplepathstudios.snowgloo.fragment;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.lifecycle.Observer;
import androidx.lifecycle.ViewModelProvider;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.simplepathstudios.snowgloo.R;
import com.simplepathstudios.snowgloo.adapter.AlbumAdapter;
import com.simplepathstudios.snowgloo.api.model.AlbumList;
import com.simplepathstudios.snowgloo.api.model.MusicAlbum;
import com.simplepathstudios.snowgloo.viewmodel.AlbumListViewModel;

import java.util.ArrayList;

public class AlbumListFragment  extends Fragment {
    private final String TAG = "AlbumListFragment";
    private RecyclerView listElement;
    private AlbumAdapter adapter;
    private LinearLayoutManager layoutManager;
    private AlbumListViewModel viewModel;

    @Override
    public View onCreateView(LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.album_list_fragment, container, false);
    }

    @Override
    public void onViewCreated(View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        listElement = view.findViewById(R.id.album_list);
        adapter = new AlbumAdapter();
        listElement.setAdapter(adapter);
        layoutManager = new LinearLayoutManager(getActivity());
        listElement.setLayoutManager(layoutManager);
        viewModel = new ViewModelProvider(this).get(AlbumListViewModel.class);
        viewModel.Data.observe(getViewLifecycleOwner(), new Observer<AlbumList>() {
            @Override
            public void onChanged(AlbumList albumList) {
                ArrayList<MusicAlbum> albums = new ArrayList<MusicAlbum>();
                for(String albumName : albumList.albums.list){
                    albums.add(albumList.albums.lookup.get(albumName));
                }
                adapter.setData(albums);
                adapter.notifyDataSetChanged();
            }
        });
        viewModel.load();
    }
}