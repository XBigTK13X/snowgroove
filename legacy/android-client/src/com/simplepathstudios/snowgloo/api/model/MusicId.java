package com.simplepathstudios.snowgloo.api.model;

import androidx.annotation.NonNull;

public class MusicId{
    public String Id;

    public MusicId(String id){
        this.Id = id;
    }

    @NonNull
    @Override
    public String toString() {
        return Id;
    }

    @Override
    public int hashCode(){
        return this.Id.hashCode();
    }

    @Override
    public boolean equals(Object obj){
        MusicId target = (MusicId)obj;
        return this.Id.equalsIgnoreCase(target.Id);
    }
}
