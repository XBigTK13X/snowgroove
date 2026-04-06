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
import com.simplepathstudios.snowgloo.adapter.CategoryAdapter;
import com.simplepathstudios.snowgloo.api.model.CategoryList;
import com.simplepathstudios.snowgloo.api.model.MusicCategory;
import com.simplepathstudios.snowgloo.viewmodel.CategoryListViewModel;

import java.util.ArrayList;

public class CategoryListFragment extends Fragment {
    private final String TAG = "CategoryListFragment";
    private RecyclerView listElement;
    private CategoryAdapter adapter;
    private LinearLayoutManager layoutManager;
    private CategoryListViewModel viewModel;
    @Override
    public View onCreateView(LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.category_list_fragment, container, false);
    }
    @Override
    public void onViewCreated(View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        listElement = view.findViewById(R.id.category_list);
        adapter = new CategoryAdapter();
        listElement.setAdapter(adapter);
        layoutManager = new LinearLayoutManager(getActivity());
        listElement.setLayoutManager(layoutManager);
        viewModel = new ViewModelProvider(this).get(CategoryListViewModel.class);
        viewModel.Data.observe(getViewLifecycleOwner(), new Observer<CategoryList>() {
            @Override
            public void onChanged(CategoryList categoryList) {
                ArrayList<MusicCategory> categories = new ArrayList<MusicCategory>();
                for(String categoryName : categoryList.list){
                    categories.add(categoryList.lookup.get(categoryName));
                }
                adapter.setData(categories);
                adapter.notifyDataSetChanged();
            }
        });
        viewModel.load();
    }
}
