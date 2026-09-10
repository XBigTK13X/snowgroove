package com.simplepathstudios.snowgroove.audiocontrols

import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class Volume(
    @Field
    @SerialName("music_session_id")
    var musicSessionId: String = "",
    @Field
    @SerialName("volume_percent")
    var volumePercent: Double = 0.0,
) : Record

@Serializable
data class MusicSession(
    @Field
    var id: String? = null,
    @Field
    @SerialName("music_queue")
    var musicQueue: MusicQueue? = null,
) : Record

@Serializable
data class MusicQueue(
    @Field
    @SerialName("current_song_index")
    var currentSongIndex: Int = 0,
    @Field
    var songs: List<AudioFile> = emptyList(),
    @Field
    var dedupe: Map<String, Boolean> = emptyMap(),
) : Record

@Serializable
data class AudioFile(
    @Field
    var album: String = "",
    @Field
    var artist: String = "",
    @Field
    @SerialName("thumbnail_web_path")
    var thumbnailWebPath: String? = null,
    @Field
    @SerialName("artwork_url")
    var rawArtworkUrl: String? = null,
    @Field
    var duration: Long = 0L,
    @Field
    var fingerprint: String = "",
    @Field
    var id: String = "",
    @Field
    @SerialName("web_path")
    var streamUrl: String = "",
    @Field
    var title: String = "",
) : Record
