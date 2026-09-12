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
    var duration: Float = 0.0f,
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

@Serializable
data class CrateSongList(
    @Field
    @SerialName("audio_files")
    var audioFiles: List<AudioFile> = emptyList(),
) : Record
