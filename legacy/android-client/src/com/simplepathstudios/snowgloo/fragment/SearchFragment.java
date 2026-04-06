package com.simplepathstudios.snowgloo.fragment;

import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.KeyEvent;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.lifecycle.Observer;
import androidx.lifecycle.ViewModelProvider;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.simplepathstudios.snowgloo.R;
import com.simplepathstudios.snowgloo.adapter.AlbumAdapter;
import com.simplepathstudios.snowgloo.adapter.ArtistAdapter;
import com.simplepathstudios.snowgloo.adapter.PlaylistAdapter;
import com.simplepathstudios.snowgloo.adapter.SongAdapter;
import com.simplepathstudios.snowgloo.api.model.SearchResults;
import com.simplepathstudios.snowgloo.viewmodel.ObservableMusicQueue;
import com.simplepathstudios.snowgloo.viewmodel.SearchResultsViewModel;

import java.util.Timer;
import java.util.TimerTask;

public class SearchFragment extends Fragment {
    private static final String TAG = "SearchFragment";

    private SearchResultsViewModel searchResultsViewModel;
    private ObservableMusicQueue observableMusicQueue;
    private EditText searchQuery;

    @Override
    public View onCreateView(LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.search_fragment, container, false);
    }

    @Override
    public void onViewCreated(View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        searchQuery = view.findViewById(R.id.search_query);
        searchQuery.setOnEditorActionListener(new TextView.OnEditorActionListener() {
            @Override
            public boolean onEditorAction(TextView v, int actionId, KeyEvent event) {
                if(actionId== EditorInfo.IME_ACTION_DONE || (event.getAction() == KeyEvent.ACTION_DOWN && event.getKeyCode() == KeyEvent.KEYCODE_ENTER)){
                    String query = searchQuery.getText().toString();
                    searchResultsViewModel.load(query);
                }
                return false;
            }
        });
        searchQuery.addTextChangedListener(new TextWatcher() {
            private Timer timer=new Timer();
            private final long DELAY = 1000; // milliseconds
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                timer.cancel();
                timer = new Timer();
                timer.schedule(
                        new TimerTask() {
                            @Override
                            public void run() {
                                if(getActivity() != null) {
                                    getActivity().runOnUiThread(new Runnable() {
                                        @Override
                                        public void run() {
                                            searchResultsViewModel.load(s.toString());
                                        }
                                    });
                                }
                            }
                        },
                        DELAY
                );

            }
            @Override
            public void afterTextChanged(Editable s) {}
        });

        observableMusicQueue = ObservableMusicQueue.getInstance();
        searchResultsViewModel = new ViewModelProvider(getActivity()).get(SearchResultsViewModel.class);
        searchResultsViewModel.Data.observe(getViewLifecycleOwner(), new Observer<SearchResults>() {
            @Override
            public void onChanged(SearchResults searchResults) {
                LinearLayout container = getView().findViewById(R.id.lists_container);
                container.removeAllViews();
                if(searchResults.Playlists != null && searchResults.Playlists.list.size() > 0){
                    View listView = getLayoutInflater().inflate(R.layout.search_result_list,container,false);
                    TextView resultKindText = listView.findViewById(R.id.result_kind);
                    resultKindText.setText("Playlists (" + searchResults.Playlists.list.size() +")");
                    RecyclerView listElement = listView.findViewById(R.id.result_list);
                    PlaylistAdapter adapter = new PlaylistAdapter();
                    listElement.setAdapter(adapter);
                    LinearLayoutManager layoutManager = new LinearLayoutManager(getActivity());
                    listElement.setLayoutManager(layoutManager);
                    adapter.setData(searchResults.Playlists);
                    adapter.notifyDataSetChanged();
                    container.addView(listView);
                }
                if(searchResults.Artists.size() > 0){
                    View listView = getLayoutInflater().inflate(R.layout.search_result_list,container,false);
                    TextView resultKindText = listView.findViewById(R.id.result_kind);
                    resultKindText.setText("Artists (" + searchResults.Artists.size() +")");
                    RecyclerView listElement = listView.findViewById(R.id.result_list);
                    ArtistAdapter adapter = new ArtistAdapter();
                    listElement.setAdapter(adapter);
                    LinearLayoutManager layoutManager = new LinearLayoutManager(getActivity());
                    listElement.setLayoutManager(layoutManager);
                    adapter.setData(searchResults.Artists);
                    adapter.notifyDataSetChanged();
                    container.addView(listView);
                }
                if(searchResults.Albums.size() > 0){
                    View listView = getLayoutInflater().inflate(R.layout.search_result_list,container,false);
                    TextView resultKindText = listView.findViewById(R.id.result_kind);
                    resultKindText.setText("Albums (" + searchResults.Albums.size() +")");
                    RecyclerView listElement = listView.findViewById(R.id.result_list);
                    AlbumAdapter adapter = new AlbumAdapter();
                    listElement.setAdapter(adapter);
                    LinearLayoutManager layoutManager = new LinearLayoutManager(getActivity());
                    listElement.setLayoutManager(layoutManager);
                    adapter.setData(searchResults.Albums);
                    adapter.notifyDataSetChanged();
                    container.addView(listView);
                }
                if(searchResults.Songs.size() > 0){
                    View listView = getLayoutInflater().inflate(R.layout.search_result_list,container,false);
                    TextView resultKindText = listView.findViewById(R.id.result_kind);
                    resultKindText.setText("Songs  (" + searchResults.Songs.size() +")");
                    RecyclerView listElement = listView.findViewById(R.id.result_list);
                    SongAdapter adapter = new SongAdapter();
                    listElement.setAdapter(adapter);
                    LinearLayoutManager layoutManager = new LinearLayoutManager(getActivity());
                    listElement.setLayoutManager(layoutManager);
                    adapter.setData(searchResults.Songs);
                    adapter.notifyDataSetChanged();
                    container.addView(listView);
                }
            }
        });
    }
}
