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
import com.simplepathstudios.snowgloo.adapter.ArtistAdapter;
import com.simplepathstudios.snowgloo.api.model.ArtistList;
import com.simplepathstudios.snowgloo.api.model.MusicArtist;
import com.simplepathstudios.snowgloo.viewmodel.ArtistListViewModel;

import java.util.ArrayList;

public class ArtistListFragment extends Fragment {
    private final String TAG = "ArtistListFragment";
    private RecyclerView listElement;
    private ArtistAdapter adapter;
    private LinearLayoutManager layoutManager;
    private ArtistListViewModel viewModel;
    @Override
    public View onCreateView(LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.artist_list_fragment, container, false);
    }
    @Override
    public void onViewCreated(View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        listElement = view.findViewById(R.id.artist_list);
        adapter = new ArtistAdapter();
        listElement.setAdapter(adapter);
        layoutManager = new LinearLayoutManager(getActivity());
        listElement.setLayoutManager(layoutManager);
        viewModel = new ViewModelProvider(this).get(ArtistListViewModel.class);
        viewModel.Data.observe(getViewLifecycleOwner(), new Observer<ArtistList>() {
            @Override
            public void onChanged(ArtistList artistList) {
                ArrayList<MusicArtist> artists = new ArrayList<MusicArtist>();
                for(String artistName : artistList.list){
                    artists.add(artistList.lookup.get(artistName));
                }
                adapter.setData(artists);
                adapter.notifyDataSetChanged();
            }
        });
        Bundle arguments = getArguments();
        if(arguments != null){
            viewModel.load(arguments.getString("Category"));
        }
    }
}
