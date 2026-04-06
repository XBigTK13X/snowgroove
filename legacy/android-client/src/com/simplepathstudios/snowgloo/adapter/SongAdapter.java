package com.simplepathstudios.snowgloo.adapter;

import android.annotation.SuppressLint;
import android.os.Bundle;
import android.view.ContextMenu;
import android.view.LayoutInflater;
import android.view.Menu;
import android.view.MenuInflater;
import android.view.MenuItem;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.PopupMenu;
import android.widget.TextView;

import androidx.annotation.Nullable;
import androidx.core.graphics.ColorUtils;
import androidx.lifecycle.Observer;
import androidx.lifecycle.ViewModelProvider;
import androidx.navigation.NavController;
import androidx.navigation.Navigation;
import androidx.recyclerview.widget.ItemTouchHelper;
import androidx.recyclerview.widget.RecyclerView;

import com.simplepathstudios.snowgloo.MainActivity;
import com.simplepathstudios.snowgloo.R;
import com.simplepathstudios.snowgloo.Util;
import com.simplepathstudios.snowgloo.api.ApiClient;
import com.simplepathstudios.snowgloo.api.model.MusicFile;
import com.simplepathstudios.snowgloo.api.model.MusicPlaylistListItem;
import com.simplepathstudios.snowgloo.api.model.MusicQueue;
import com.simplepathstudios.snowgloo.api.model.PlaylistAddResult;
import com.simplepathstudios.snowgloo.api.model.PlaylistList;
import com.simplepathstudios.snowgloo.audio.AudioPlayer;
import com.simplepathstudios.snowgloo.viewmodel.ObservableMusicQueue;
import com.simplepathstudios.snowgloo.viewmodel.PlaylistListViewModel;
import com.squareup.picasso.Callback;
import com.squareup.picasso.Picasso;

import java.util.ArrayList;

import retrofit2.Call;
import retrofit2.Response;

import static androidx.recyclerview.widget.ItemTouchHelper.ACTION_STATE_DRAG;

public class SongAdapter extends RecyclerView.Adapter<SongAdapter.ViewHolder> {

    public static String TAG = "SongAdapter";

    public enum Kind {
        QUEUE,
        TRACKS
    }

    private ArrayList<MusicFile> songs;
    private Kind kind;
    private ItemTouchHelper itemTouchHelper;
    private View view;

    public SongAdapter(RecyclerView reorderableListView) {
        this.kind = Kind.QUEUE;
        itemTouchHelper = new ItemTouchHelper(new RecyclerViewCallback());
        itemTouchHelper.attachToRecyclerView(reorderableListView);
    }

    public SongAdapter() {
        this.kind = Kind.TRACKS;
        this.songs = null;
    }

    public void setData(ArrayList<MusicFile> songs) {
        this.songs = songs;
    }

    @Override
    public ViewHolder onCreateViewHolder(ViewGroup parent, int viewType) {
        LinearLayout v = (LinearLayout) LayoutInflater.from(parent.getContext())
                .inflate(R.layout.song_list_item, parent, false);
        view = v;
        return new ViewHolder(v);
    }

    @Override
    public void onBindViewHolder(SongAdapter.ViewHolder holder, int position) {
        holder.musicFile = this.songs.get(position);
        if (kind != Kind.QUEUE) {
            if (holder.musicFile.ThumbnailCoverArt != null && !holder.musicFile.ThumbnailCoverArt.isEmpty()) {
                Picasso.get().load(holder.musicFile.ThumbnailCoverArt).into(holder.coverArt, new Callback() {
                    @Override
                    public void onSuccess() {
                        holder.coverArt.setVisibility(View.VISIBLE);
                    }

                    @Override
                    public void onError(Exception e) {
                    }
                });
            }
        } else {
            holder.coverArt.setVisibility(View.GONE);
            if (holder.musicFile.ThumbnailCoverArt != null && !holder.musicFile.ThumbnailCoverArt.isEmpty()) {
                Picasso.get().load(holder.musicFile.ThumbnailCoverArt).into(holder.dragHandle, new Callback() {
                    @Override
                    public void onSuccess() {
                        holder.dragHandle.setVisibility(View.VISIBLE);
                    }

                    @Override
                    public void onError(Exception e) {
                    }
                });
            }
        }

        TextView title = holder.titleText;
        title.setText(holder.musicFile.Title);
        TextView album = holder.albumText;
        album.setText(holder.musicFile.DisplayAlbum);
        TextView artist = holder.artistText;
        artist.setText(holder.musicFile.DisplayArtist);
        if (kind == Kind.QUEUE) {
            Integer currentIndex = ObservableMusicQueue.getInstance().getQueue().currentIndex;
            if (currentIndex != null) {
                boolean isSelected = position == currentIndex;
                title.setTextColor(
                        ColorUtils.setAlphaComponent(
                                title.getCurrentTextColor(),
                                isSelected ? 255 : 100));
                album.setTextColor(
                        ColorUtils.setAlphaComponent(
                                album.getCurrentTextColor(),
                                isSelected ? 255 : 100));
                artist.setTextColor(
                        ColorUtils.setAlphaComponent(
                                artist.getCurrentTextColor(),
                                isSelected ? 255 : 100));
            }
        }
    }

    @Override
    public int getItemCount() {
        if (this.songs == null) {
            return 0;
        }
        return this.songs.size();
    }

    class ViewHolder extends RecyclerView.ViewHolder implements View.OnCreateContextMenuListener {

        public ViewHolder self;
        public MusicFile musicFile;
        public TextView titleText;
        public TextView albumText;
        public TextView artistText;
        public ImageView coverArt;
        public ImageView dragHandle;

        @SuppressLint("ClickableViewAccessibility")
        public ViewHolder(LinearLayout layout) {
            super(layout);
            self = this;
            this.titleText = layout.findViewById(R.id.title);
            this.albumText = layout.findViewById(R.id.album);
            this.artistText = layout.findViewById(R.id.artist);
            this.coverArt = layout.findViewById(R.id.cover_art);
            itemView.setOnClickListener(new View.OnClickListener() {
                public void onClick(View v) {
                    if (kind == Kind.QUEUE) {
                        ObservableMusicQueue.getInstance().setCurrentIndex(getAbsoluteAdapterPosition());
                        AudioPlayer.getInstance().play();
                    } else {
                        ObservableMusicQueue.getInstance().addItem(musicFile);
                    }
                }
            });
            itemView.setOnCreateContextMenuListener(this);
            if (kind == Kind.QUEUE) {
                this.dragHandle = layout.findViewById(R.id.handle);
                this.dragHandle.setVisibility(View.VISIBLE);
                this.dragHandle.setOnTouchListener(new View.OnTouchListener() {
                    @Override
                    public boolean onTouch(View v, MotionEvent event) {
                        if (event.getActionMasked() == MotionEvent.ACTION_DOWN) {
                            itemTouchHelper.startDrag(self);
                        }
                        return true;
                    }
                });
            }
        }

        public void onCreateContextMenu(ContextMenu menu, View v,
                ContextMenu.ContextMenuInfo menuInfo) {
            MenuItem viewAlbumAction = menu.add("View Album");
            viewAlbumAction.setOnMenuItemClickListener(new MenuItem.OnMenuItemClickListener() {
                @Override
                public boolean onMenuItemClick(MenuItem item) {
                    NavController navController = Navigation.findNavController(MainActivity.getInstance(), R.id.nav_host_fragment);
                    Bundle bundle = new Bundle();
                    bundle.putString("AlbumSlug", musicFile.AlbumSlug);
                    bundle.putString("AlbumDisplay", musicFile.Album + " (" + musicFile.ReleaseYear + ")");
                    navController.navigate(R.id.album_view_fragment, bundle);
                    return false;
                }
            });
            MenuItem viewArtistAction = menu.add("View Artist");
            viewArtistAction.setOnMenuItemClickListener(new MenuItem.OnMenuItemClickListener() {
                @Override
                public boolean onMenuItemClick(MenuItem item) {
                    NavController navController = Navigation.findNavController(MainActivity.getInstance(), R.id.nav_host_fragment);
                    Bundle bundle = new Bundle();
                    bundle.putString("Artist", musicFile.Artist);
                    navController.navigate(R.id.artist_view_fragment, bundle);
                    return false;
                }
            });
            MenuItem playNextAction = menu.add("Play Next");
            playNextAction.setOnMenuItemClickListener(new MenuItem.OnMenuItemClickListener() {
                @Override
                public boolean onMenuItemClick(MenuItem item) {
                    Integer songIndex = ObservableMusicQueue.getInstance().getIndex(musicFile);
                    Integer currentIndex = ObservableMusicQueue.getInstance().getQueue().currentIndex;
                    if (currentIndex == null) {
                        currentIndex = 0;
                    }
                    if (songIndex == null) {
                        ObservableMusicQueue.getInstance().addItem(musicFile);
                        songIndex = ObservableMusicQueue.getInstance().getIndex(musicFile);
                    }
                    if (songIndex != currentIndex) {
                        if (songIndex < currentIndex) {
                            ObservableMusicQueue.getInstance().moveItem(musicFile, songIndex, currentIndex);
                        } else {
                            ObservableMusicQueue.getInstance().moveItem(musicFile, songIndex, currentIndex + 1);
                        }
                    }
                    return false;
                }
            });
            if (kind != Kind.QUEUE) {
                MenuItem findInQueue = menu.add("Find in queue");
                findInQueue.setOnMenuItemClickListener(new MenuItem.OnMenuItemClickListener() {
                    @Override
                    public boolean onMenuItemClick(MenuItem item) {
                        Integer songIndex = ObservableMusicQueue.getInstance().getIndex(musicFile);
                        if (songIndex == null) {
                            Util.toast("Song not currently in queue.");
                        } else {
                            Bundle bundle = new Bundle();
                            bundle.putInt("ScrollToItemIndex", songIndex);
                            Navigation.findNavController(MainActivity.getInstance(), R.id.nav_host_fragment).navigate(R.id.queue_fragment, bundle);
                        }
                        return false;
                    }
                });
            }
            MenuItem addToPlaylistAction = menu.add("Add to Playlist");
            addToPlaylistAction.setOnMenuItemClickListener(new MenuItem.OnMenuItemClickListener() {
                @Override
                public boolean onMenuItemClick(MenuItem menuItem) {
                    PopupMenu popup = new PopupMenu(MainActivity.getInstance(), v);
                    popup.setOnMenuItemClickListener(new PopupMenu.OnMenuItemClickListener() {
                        @Override
                        public boolean onMenuItemClick(MenuItem menuItem) {
                            return false;
                        }
                    });

                    MenuInflater inflater = popup.getMenuInflater();
                    inflater.inflate(R.menu.playlist_popup, popup.getMenu());
                    Menu popupMenu = popup.getMenu();
                    for (MusicPlaylistListItem playlist : MainActivity.getInstance().getPlaylists()) {
                        MenuItem playlistItem = popupMenu.add(playlist.name);
                        playlistItem.setOnMenuItemClickListener(new MenuItem.OnMenuItemClickListener() {
                            @Override
                            public boolean onMenuItemClick(MenuItem menuItem) {
                                ApiClient.getInstance().addToPlaylist(playlist.id, musicFile.Id).enqueue(new retrofit2.Callback<PlaylistAddResult>() {
                                    @Override
                                    public void onResponse(Call call, Response response) {
                                        PlaylistAddResult result = (PlaylistAddResult) response.body();
                                        if (result != null && !result.success && result.error.contains("Already")) {
                                            Util.toast(musicFile.Title + " is already in playlist " + playlist.name);
                                        } else {
                                            Util.toast("Added song to playlist.");
                                        }
                                    }

                                    @Override
                                    public void onFailure(Call call, Throwable t) {
                                        Util.toast("Unable to add song to playlist");
                                        Util.log(TAG, "Unable to add song to playlist");
                                        Util.error(TAG, t);
                                    }
                                });
                                return false;
                            }
                        });
                    }
                    popup.show();
                    return false;
                }
            });
        }
    }

    private class RecyclerViewCallback extends ItemTouchHelper.SimpleCallback {

        private int draggingFromPosition;
        private int draggingToPosition;

        public RecyclerViewCallback() {
            super(ItemTouchHelper.UP | ItemTouchHelper.DOWN, ItemTouchHelper.START | ItemTouchHelper.END);
            draggingFromPosition = -1;
            draggingToPosition = -1;
        }

        @Override
        public void onSelectedChanged(@Nullable RecyclerView.ViewHolder viewHolder, int actionState) {
            if (actionState == ACTION_STATE_DRAG) {
                viewHolder.itemView.setAlpha(0.5f);
            }
        }

        @Override
        public boolean onMove(RecyclerView list, RecyclerView.ViewHolder origin, RecyclerView.ViewHolder target) {
            int fromPosition = origin.getAbsoluteAdapterPosition();
            int toPosition = target.getAbsoluteAdapterPosition();
            if (draggingFromPosition == -1) {
                // A drag has started, but changes to the media queue will be reflected in clearView().
                draggingFromPosition = fromPosition;
            }
            draggingToPosition = toPosition;
            notifyItemMoved(fromPosition, toPosition);
            return true;
        }

        @Override
        public void onSwiped(RecyclerView.ViewHolder viewHolder, int direction) {
            int position = viewHolder.getAbsoluteAdapterPosition();
            MusicQueue musicQueue = ObservableMusicQueue.getInstance().getQueue();
            if (musicQueue.currentIndex != null && musicQueue.currentIndex == position) {
                AudioPlayer.getInstance().stop();
            }
            ObservableMusicQueue.getInstance().removeItem(position);
        }

        @Override
        public void clearView(RecyclerView recyclerView, RecyclerView.ViewHolder viewHolder) {
            super.clearView(recyclerView, viewHolder);
            viewHolder.itemView.setAlpha(1.0f);
            if (draggingFromPosition != -1) {
                ViewHolder holder = (ViewHolder) viewHolder;
                ObservableMusicQueue.getInstance().moveItem(holder.musicFile, draggingFromPosition, draggingToPosition);
            }
            draggingFromPosition = -1;
            draggingToPosition = -1;
        }

        @Override
        public boolean isLongPressDragEnabled() {
            return false;
        }
    }
}
