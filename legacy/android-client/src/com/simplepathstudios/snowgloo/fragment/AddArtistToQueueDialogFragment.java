package com.simplepathstudios.snowgloo.fragment;

import android.app.AlertDialog;
import android.app.Dialog;
import android.content.DialogInterface;
import android.os.Bundle;

import androidx.fragment.app.DialogFragment;

import com.simplepathstudios.snowgloo.R;
import com.simplepathstudios.snowgloo.api.model.ArtistView;
import com.simplepathstudios.snowgloo.api.model.MusicFile;
import com.simplepathstudios.snowgloo.viewmodel.ArtistViewViewModel;
import com.simplepathstudios.snowgloo.viewmodel.ObservableMusicQueue;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;

public class AddArtistToQueueDialogFragment extends DialogFragment {
    private ArrayList<String> selectedItems;
    private String[] possibleItems;
    private ArtistViewViewModel artistViewViewModel;
    private ObservableMusicQueue musicQueueViewModel;

    public AddArtistToQueueDialogFragment(ArtistViewViewModel artistViewViewModel, ObservableMusicQueue musicQueueViewModel){
        this.artistViewViewModel = artistViewViewModel;
        this.musicQueueViewModel = musicQueueViewModel;
    }

    private class SortSongs implements Comparator<MusicFile>{

        @Override
        public int compare(MusicFile o1, MusicFile o2) {
            if(!o1.ReleaseYear.equals(o2.ReleaseYear)){
                return o1.ReleaseYear > o2.ReleaseYear ? 1 : -1;
            }
            if(!o1.ReleaseYearSort.equals(o2.ReleaseYearSort)){
                return o1.ReleaseYearSort > o2.ReleaseYearSort ? 1 : -1;
            }
            if(!o1.Album.equalsIgnoreCase(o2.Album)){
                return o1.Album.compareTo(o2.Album);
            }
            if(!o1.Disc.equals(o2.Disc)){
                return o1.Disc > o2.Disc ? 1 : -1;
            }
            return o1.Track > o2.Track ? 1 : -1;
        }
    }

    @Override
    public Dialog onCreateDialog(Bundle savedInstanceState) {
        selectedItems = new ArrayList(){{
            add("Album");
            add("Single");
        }};
        possibleItems = getResources().getStringArray(R.array.album_kinds);
        AlertDialog.Builder builder = new AlertDialog.Builder(getActivity());
        builder.setTitle("Add to the queue?")
                .setMultiChoiceItems(R.array.album_kinds, new boolean[]{true,true,false,false},
                        new DialogInterface.OnMultiChoiceClickListener() {
                            @Override
                            public void onClick(DialogInterface dialog, int which, boolean isChecked) {
                                String item = possibleItems[which];
                                if (isChecked) {
                                    selectedItems.add(item);
                                } else if (selectedItems.contains(item)) {
                                    selectedItems.remove(item);
                                }
                            }
                        })
                .setPositiveButton("Queue Up", new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int id) {
                        ArrayList<String> selected = selectedItems;
                        ArrayList<MusicFile> selectedAlbumSongs = new ArrayList();
                        ArtistView artistView = artistViewViewModel.Data.getValue();
                        for(String albumKind : selected){
                            for(String albumSlug: artistView.albums.lists.get(albumKind)){
                                selectedAlbumSongs.addAll(artistView.albums.lookup.get(albumSlug).Songs);
                            }
                        }
                        Collections.sort(selectedAlbumSongs,new SortSongs());
                        musicQueueViewModel.addItems(selectedAlbumSongs);
                    }
                })
                .setNegativeButton("Cancel", new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int id) {

                    }
                });

        return builder.create();
    }
}
