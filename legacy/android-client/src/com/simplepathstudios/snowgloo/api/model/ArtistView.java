package com.simplepathstudios.snowgloo.api.model;

import java.util.ArrayList;
import java.util.HashMap;

public class ArtistView {
    public Root albums;

    public class Root {
        public ArrayList<String> listKinds;
        public HashMap<String,MusicAlbum> lookup;
        public HashMap<String,ArrayList<String>> lists;
    }
}
