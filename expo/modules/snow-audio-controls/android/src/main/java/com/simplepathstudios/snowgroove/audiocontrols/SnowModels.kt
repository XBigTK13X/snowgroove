package com.simplepathstudios.snowgroove.audiocontrols

import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.json.longOrNull

val sharedJson =
    Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

fun JsonElement.toAny(): Any? =
    when (this) {
        is JsonNull -> {
            null
        }

        is JsonPrimitive -> {
            if (isString) {
                content
            } else {
                booleanOrNull ?: longOrNull ?: doubleOrNull ?: content
            }
        }

        is JsonArray -> {
            map { it.toAny() }
        }

        is JsonObject -> {
            mapValues { it.value.toAny() }
        }
    }

inline fun <reified T> T.toMap(): Map<String, Any?> {
    val element = sharedJson.encodeToJsonElement(this)
    if (element is JsonObject) {
        return element.mapValues { it.value.toAny() }
    }
    return emptyMap()
}

@Serializable
data class Volume(
    @Field
    @SerialName("music_session_id")
    var musicSessionId: Int? = null,
    @Field
    @SerialName("volume_percent")
    var volumePercent: Double = 0.0,
) : Record

@Serializable
data class MusicSession(
    @SerialName("music_session_id")
    @Field
    var writeId: Int? = null,
    @SerialName("id")
    @Field
    var id: Int? = null,
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
    @Field("album_crate_id")
    @SerialName("album_crate_id")
    var albumCrateId: Int? = null,
    @Field
    var artist: String = "",
    @Field("artist_crate_id")
    @SerialName("artist_crate_id")
    var artistCrateId: Int? = null,
    @Field("crate_id")
    @SerialName("crate_id")
    var crateId: Int? = null,
    @Field("crate_title")
    @SerialName("crate_title")
    var crateTitle: String? = null,
    @Field("crate_year")
    @SerialName("crate_year")
    var crateYear: Int? = null,
    @Field("crate_year_order")
    @SerialName("crate_year_order")
    var crateYearOrder: Int? = null,
    @Field("created_at")
    @SerialName("created_at")
    var createdAt: String? = null,
    @Field
    var disc: Int? = null,
    @Field
    var duration: Double = 0.0,
    @Field("ffprobe_raw_json")
    @SerialName("ffprobe_raw_json")
    var ffprobeRawJson: String? = null,
    @Field
    var fingerprint: String = "",
    @Field
    var id: Int = 0,
    @Field
    var kind: String = "",
    @Field("local_path")
    @SerialName("local_path")
    var localPath: String? = null,
    @Field
    var lyrics: String? = null,
    @Field("model_kind")
    @SerialName("model_kind")
    var modelKind: String? = null,
    @Field("network_path")
    @SerialName("network_path")
    var networkPath: String? = null,
    @Field
    var position: String? = null,
    @Field("snowgroove_info_json")
    @SerialName("snowgroove_info_json")
    var snowgrooveInfoJson: String? = null,
    @Field("thumbnail_web_path")
    @SerialName("thumbnail_web_path")
    var thumbnailWebPath: String? = null,
    @Field
    var title: String = "",
    @Field
    var track: Int? = null,
    @Field("updated_at")
    @SerialName("updated_at")
    var updatedAt: String? = null,
    @Field("web_path")
    @SerialName("web_path")
    var webPath: String = "",
    @Field
    var year: Int? = null,
) : Record

@Serializable
data class CrateSongList(
    @Field
    @SerialName("audio_files")
    var audioFiles: List<AudioFile> = emptyList(),
) : Record

@Serializable
data class PlayerStatus(
    @Field("position_seconds")
    @SerialName("position_seconds")
    var positionSeconds: Long? = 0L,
    @Field("duration_seconds")
    @SerialName("duration_seconds")
    var durationSeconds: Long? = 0L,
    @Field("is_playing")
    @SerialName("is_playing")
    var isPlaying: Boolean? = false,
    @Field("player_state")
    @SerialName("player_state")
    var playerState: String? = "stopped",
    @Field("queue_fingerprint")
    @SerialName("queue_fingerprint")
    var queueFingerprint: String? = "",
    @Field("current_song_index")
    @SerialName("current_song_index")
    var currentSongIndex: Int? = 0,
    @Field("is_loaded")
    @SerialName("is_loaded")
    var isLoaded: Boolean? = false,
    @Field("volume")
    @SerialName("volume")
    var volume: Double? = 0.0,
) : Record
