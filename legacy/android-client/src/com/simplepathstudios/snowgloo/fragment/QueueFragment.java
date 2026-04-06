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
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.simplepathstudios.snowgloo.MainActivity;
import com.simplepathstudios.snowgloo.R;
import com.simplepathstudios.snowgloo.SnowglooSettings;
import com.simplepathstudios.snowgloo.Util;
import com.simplepathstudios.snowgloo.adapter.SongAdapter;
import com.simplepathstudios.snowgloo.api.model.MusicQueue;
import com.simplepathstudios.snowgloo.audio.AudioPlayer;
import com.simplepathstudios.snowgloo.viewmodel.ObservableMusicQueue;


public class QueueFragment extends Fragment {
    static final String TAG = "QueueFragment";
    static final Integer ITEM_CENTER_OFFSET = 4;

    private SongAdapter adapter;
    private ObservableMusicQueue observableMusicQueue;
    private LinearLayoutManager layoutManager;
    private RecyclerView listView;
    private MenuItem clearQueueButton;
    private MenuItem shuffleQueueButton;
    private MenuItem changeRepeatModeButton;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setHasOptionsMenu(true);
    }

    @Override
    public void onCreateOptionsMenu(Menu menu, MenuInflater inflater) {
        super.onCreateOptionsMenu(menu, inflater);

        inflater.inflate(R.menu.queue_action_menu, menu);

        clearQueueButton = menu.findItem(R.id.clear_queue_button);
        Util.confirmMenuAction(clearQueueButton, "Clear the queue?", new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                observableMusicQueue.clear();
                AudioPlayer.getInstance().stop();
            }
        });
        shuffleQueueButton = menu.findItem(R.id.shuffle_queue_button);
        Util.confirmMenuAction(shuffleQueueButton, "Shuffle the queue?", new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                observableMusicQueue.shuffle();
                AudioPlayer.getInstance().play();
            }
        });
        changeRepeatModeButton = menu.findItem(R.id.repeat_button);
        changeRepeatModeButton.setOnMenuItemClickListener(new MenuItem.OnMenuItemClickListener() {
            @Override
            public boolean onMenuItemClick(MenuItem item) {
                ObservableMusicQueue.getInstance().cycleRepeatMode();
                switch(ObservableMusicQueue.getInstance().getRepeatMode()){
                    case None:
                        changeRepeatModeButton.setIcon(R.drawable.ic_play_once_black_24dp);
                        break;
                    case One:
                        changeRepeatModeButton.setIcon(R.drawable.ic_repeat_one_black_24dp);
                        break;
                    case All:
                        changeRepeatModeButton.setIcon(R.drawable.ic_repeat_all_black_24dp);
                        break;
                }

                return false;
            }
        });
    }

    @Override
    public View onCreateView(LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.queue_fragment, container, false);
    }

    private void scrollTo(Integer itemIndex){
        if(itemIndex != null && adapter.getItemCount() > itemIndex) {
            // TODO This is a workaround to ensure the recyclerview is populated before scrolling.
            // There should be a better way, but this is the only thing I could get it working.
            listView.postDelayed(new Runnable() {
                @Override
                public void run() {
                    layoutManager.scrollToPosition(itemIndex);
                }
            }, SnowglooSettings.QueuePopulatedDelayMilliseconds);
        }
    }

    @Override
    public void onViewCreated(View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);



        listView = view.findViewById(R.id.music_queue);

        adapter = new SongAdapter(listView);
        listView.setAdapter(adapter);
        layoutManager = new LinearLayoutManager(getActivity());
        listView.setLayoutManager(layoutManager);

        observableMusicQueue = ObservableMusicQueue.getInstance();
        ObservableMusicQueue.getInstance().observe(new Observer<MusicQueue>() {
            @Override
            public void onChanged(MusicQueue musicQueue) {
                if(isVisible() && MainActivity.getInstance() != null && musicQueue != null){
                    if(musicQueue.getSize() > 0){
                        String queueInfo = musicQueue.getSize() + " songs - " + musicQueue.durationTimestamp;
                        MainActivity.getInstance().setActionBarSubtitle(queueInfo);
                    } else {
                        MainActivity.getInstance().setActionBarSubtitle("");
                    }

                }
                adapter.setData(musicQueue.getAll());
                adapter.notifyDataSetChanged();
            }
        });

        Bundle arguments = getArguments();
        if(arguments != null){
            scrollTo(arguments.getInt("ScrollToItemIndex") + ITEM_CENTER_OFFSET);
        }
    }
}
