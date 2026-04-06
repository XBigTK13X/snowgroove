package com.simplepathstudios.snowgloo.api.model;

import java.util.ArrayList;
import java.util.HashMap;

public class AlbumList {
    public Root albums;

    public class Root {
        public HashMap<String,MusicAlbum> lookup;
        public ArrayList<String> list;
    }
}
