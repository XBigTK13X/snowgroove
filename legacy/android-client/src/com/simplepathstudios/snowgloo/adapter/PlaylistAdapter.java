package com.simplepathstudios.snowgloo.adapter;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.navigation.NavController;
import androidx.navigation.Navigation;
import androidx.recyclerview.widget.RecyclerView;

import com.simplepathstudios.snowgloo.MainActivity;
import com.simplepathstudios.snowgloo.R;
import com.simplepathstudios.snowgloo.api.model.MusicPlaylistListItem;
import com.simplepathstudios.snowgloo.api.model.PlaylistList;

public class PlaylistAdapter extends RecyclerView.Adapter<PlaylistAdapter.ViewHolder> {
    private PlaylistList data;
    public PlaylistAdapter(){
        this.data = null;
    }

    public void setData(PlaylistList data){
        this.data = data;
    }

    @Override
    public PlaylistAdapter.ViewHolder onCreateViewHolder(ViewGroup parent, int viewType) {
        TextView v = (TextView) LayoutInflater.from(parent.getContext())
                .inflate(R.layout.small_list_item, parent, false);
        return new PlaylistAdapter.ViewHolder(v);
    }

    @Override
    public void onBindViewHolder(PlaylistAdapter.ViewHolder holder, int position) {
        MusicPlaylistListItem playlist = this.data.list.get(position);
        holder.playlist = playlist;
        TextView view = holder.textView;
        view.setText(holder.playlist.name);
    }

    @Override
    public int getItemCount() {
        if(this.data == null || this.data.list == null){
            return 0;
        }
        return this.data.list.size();
    }

    class ViewHolder extends RecyclerView.ViewHolder implements View.OnClickListener {

        public final TextView textView;
        public MusicPlaylistListItem playlist;

        public ViewHolder(TextView textView) {
            super(textView);
            this.textView = textView;
            textView.setOnClickListener(this);
        }

        @Override
        public void onClick(View v) {
            NavController navController = Navigation.findNavController(MainActivity.getInstance(),R.id.nav_host_fragment);
            Bundle bundle = new Bundle();
            bundle.putString("PlaylistName", playlist.name);
            bundle.putString("PlaylistId", playlist.id);
            navController.navigate(R.id.playlist_view_fragment, bundle);
        }

    }
}
