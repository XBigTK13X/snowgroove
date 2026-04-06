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
import com.simplepathstudios.snowgloo.api.model.MusicCategory;

import java.util.ArrayList;

public class CategoryAdapter extends RecyclerView.Adapter<CategoryAdapter.ViewHolder> {
    private ArrayList<MusicCategory> data;
    public CategoryAdapter(){
        this.data = null;
    }

    public void setData(ArrayList<MusicCategory> data){
        this.data = data;
    }

    @Override
    public ViewHolder onCreateViewHolder(ViewGroup parent, int viewType) {
        TextView v = (TextView) LayoutInflater.from(parent.getContext())
                .inflate(R.layout.small_list_item, parent, false);
        return new ViewHolder(v);
    }

    @Override
    public void onBindViewHolder(CategoryAdapter.ViewHolder holder, int position) {
        holder.category = this.data.get(position);
        TextView view = holder.textView;
        view.setText(holder.category.Name);
    }

    @Override
    public int getItemCount() {
        if(this.data == null){
            return 0;
        }
        return this.data.size();
    }

    public class ViewHolder extends RecyclerView.ViewHolder implements View.OnClickListener {

        public final TextView textView;
        public MusicCategory category;

        public ViewHolder(TextView textView) {
            super(textView);
            this.textView = textView;
            textView.setOnClickListener(this);
        }

        @Override
        public void onClick(View v) {
            NavController navController = Navigation.findNavController(MainActivity.getInstance(), R.id.nav_host_fragment);
            Bundle bundle = new Bundle();
            if(category.Kind.equalsIgnoreCase("ArtistView")){
                bundle.putString("Artist", category.Name);
                navController.navigate(R.id.artist_view_fragment, bundle);
            } else {
                bundle.putString("Category", category.Name);
                navController.navigate(R.id.artist_list_fragment, bundle);
            }
        }
    }
}
