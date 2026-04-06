package com.simplepathstudios.snowgloo.adapter;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.navigation.NavController;
import androidx.navigation.Navigation;
import androidx.recyclerview.widget.RecyclerView;

import com.simplepathstudios.snowgloo.MainActivity;
import com.simplepathstudios.snowgloo.R;
import com.simplepathstudios.snowgloo.api.model.MusicAlbum;
import com.squareup.picasso.Callback;
import com.squareup.picasso.Picasso;

import java.util.ArrayList;

public class AlbumAdapter extends RecyclerView.Adapter<AlbumAdapter.ViewHolder> {

    private ArrayList<MusicAlbum> data;

    public AlbumAdapter() {
        this.data = null;
    }

    public void setData(ArrayList<MusicAlbum> data) {
        this.data = data;
    }

    @Override
    public AlbumAdapter.ViewHolder onCreateViewHolder(ViewGroup parent, int viewType) {
        LinearLayout layout = (LinearLayout) LayoutInflater.from(parent.getContext())
                .inflate(R.layout.album_list_item, parent, false);
        return new AlbumAdapter.ViewHolder(layout);
    }

    @Override
    public void onBindViewHolder(AlbumAdapter.ViewHolder holder, int position) {
        holder.musicAlbum = this.data.get(position);
        TextView album = holder.albumText;
        album.setText(holder.musicAlbum.DisplayAlbum);
        TextView artist = holder.artistText;
        artist.setText(holder.musicAlbum.DisplayArtist);
        TextView year = holder.yearText;
        year.setText(holder.musicAlbum.ReleaseYear);
        if (holder.musicAlbum.ThumbnailCoverArt != null && !holder.musicAlbum.ThumbnailCoverArt.isEmpty()) {
            Picasso.get().load(holder.musicAlbum.ThumbnailCoverArt).into(holder.coverArt, new Callback() {
                @Override
                public void onSuccess() {
                    holder.coverArt.setVisibility(View.VISIBLE);
                }

                @Override
                public void onError(Exception e) {
                }
            });
        }
    }

    @Override
    public int getItemCount() {
        if (this.data == null) {
            return 0;
        }
        return this.data.size();
    }

    public class ViewHolder extends RecyclerView.ViewHolder implements View.OnClickListener {

        public MusicAlbum musicAlbum;
        public TextView yearText;
        public TextView albumText;
        public TextView artistText;
        public ImageView coverArt;

        public ViewHolder(LinearLayout layout) {
            super(layout);
            this.yearText = layout.findViewById(R.id.year);
            this.albumText = layout.findViewById(R.id.album);
            this.artistText = layout.findViewById(R.id.artist);
            this.coverArt = layout.findViewById(R.id.cover_art);
            itemView.setOnClickListener(this);
        }

        @Override
        public void onClick(View v) {
            NavController navController = Navigation.findNavController(MainActivity.getInstance(), R.id.nav_host_fragment);
            Bundle bundle = new Bundle();
            bundle.putString("AlbumSlug", musicAlbum.AlbumSlug);
            bundle.putString("AlbumDisplay", musicAlbum.Album + " (" + musicAlbum.ReleaseYear + ")");
            navController.navigate(R.id.album_view_fragment, bundle);
        }
    }
}
