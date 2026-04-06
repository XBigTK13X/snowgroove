package com.simplepathstudios.snowgloo.fragment;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.lifecycle.Observer;
import androidx.lifecycle.ViewModelProvider;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.simplepathstudios.snowgloo.R;
import com.simplepathstudios.snowgloo.api.model.UserList;
import com.simplepathstudios.snowgloo.viewmodel.SettingsViewModel;
import com.simplepathstudios.snowgloo.viewmodel.UserListViewModel;

public class UserListFragment extends Fragment {
    private static final String TAG = "UserListFragment";
    private RecyclerView listElement;
    private UserListFragment.Adapter adapter;
    private LinearLayoutManager layoutManager;
    private UserListViewModel userListViewModel;
    private SettingsViewModel settingsViewModel;

    @Override
    public View onCreateView(LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.user_list_fragment, container, false);
    }

    @Override
    public void onViewCreated(View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        listElement = view.findViewById(R.id.user_list);
        adapter = new UserListFragment.Adapter();
        listElement.setAdapter(adapter);
        layoutManager = new LinearLayoutManager(getActivity());
        listElement.setLayoutManager(layoutManager);
        settingsViewModel = new ViewModelProvider(getActivity()).get(SettingsViewModel.class);
        userListViewModel = new ViewModelProvider(this).get(UserListViewModel.class);
        userListViewModel.Data.observe(getViewLifecycleOwner(), new Observer<UserList>() {
            @Override
            public void onChanged(UserList userList) {
                adapter.setData(userList);
                adapter.notifyDataSetChanged();
            }
        });
        userListViewModel.load();
    }

    private class ViewHolder extends RecyclerView.ViewHolder implements View.OnClickListener {

        public final TextView textView;
        public String Username;

        public ViewHolder(TextView textView) {
            super(textView);
            this.textView = textView;
            textView.setOnClickListener(this);
        }

        @Override
        public void onClick(View v) {
            settingsViewModel.setUsername(Username);
        }
    }

    private class Adapter extends RecyclerView.Adapter<UserListFragment.ViewHolder> {
        private UserList data;

        public Adapter() {
            this.data = null;
        }

        public void setData(UserList data) {
            this.data = data;
        }

        @Override
        public UserListFragment.ViewHolder onCreateViewHolder(ViewGroup parent, int viewType) {
            TextView v = (TextView) LayoutInflater.from(parent.getContext())
                    .inflate(R.layout.small_list_item, parent, false);
            return new UserListFragment.ViewHolder(v);
        }

        @Override
        public void onBindViewHolder(UserListFragment.ViewHolder holder, int position) {
            String username = this.data.users.get(position);
            holder.Username = username;
            TextView view = holder.textView;
            view.setText(username);
        }

        @Override
        public int getItemCount() {
            if (this.data == null || this.data.users == null) {
                return 0;
            }
            return this.data.users.size();
        }
    }
}
