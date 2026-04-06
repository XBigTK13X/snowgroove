package com.simplepathstudios.snowgloo.api.model;

import com.simplepathstudios.snowgloo.Util;

public class MusicFile {
    public static final String TAG = "MusicFile";
    public static final MusicFile EMPTY = new MusicFile(){{
        DisplayAlbum = "";
        DisplayArtist = "";
        Title = "No music playing";
        Id = null;
    }};

    public String Album;
    public String AlbumSlug;
    public String DisplayAlbum;
    public String Artist;
    public String DisplayArtist;
    public String AudioUrl;
    public Integer ReleaseYear;
    public Float ReleaseYearSort;
    public String CoverArt;
    public String ThumbnailCoverArt;
    public String Title;
    public Integer Disc;
    public Integer Track;
    public String Id;
    public String LocalFilePath;
    public Float AudioDuration;
    private String oneLineMetadata;

    // This exists to workaround Java failing to match hashes in the queue HashMap
    private transient MusicId lookupId;

    public MusicFile(){}

    public MusicId getLookupId(){
        if(this.lookupId == null){
            this.lookupId = new MusicId(this.Id);
        }
        return this.lookupId;
    }

    public String getOneLineMetadata(){
        if(oneLineMetadata == null){
            if(Id == null){
                oneLineMetadata = String.format("%s", this.Title);
            } else {
                oneLineMetadata = String.format("%s - %s - %s", this.Title, this.DisplayAlbum, this.DisplayArtist);
            }
        }
        return oneLineMetadata;
    }
}
