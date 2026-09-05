import { requireNativeModule, EventEmitter } from 'expo-modules-core'
import { Platform } from 'react-native'

const NativeAudio = Platform.OS === 'android' ? requireNativeModule('SnowAudioControls') : null
const emitter = NativeAudio ? new EventEmitter(NativeAudio) : null

export class SnowAudioControls {
    static play(params) {
        if (!NativeAudio) return
        NativeAudio.play({
            uri: params.uri || '',
            title: params.title || '',
            artist: params.artist || '',
            album: params.album || '',
            artworkUrl: params.artworkUrl || '',
            duration: params.duration || 0
        })
    }

    static resume() {
        if (NativeAudio) NativeAudio.resume()
    }

    static pause() {
        if (NativeAudio) NativeAudio.pause()
    }

    static stop() {
        if (NativeAudio) NativeAudio.stop()
    }

    static seek(seconds) {
        if (NativeAudio) NativeAudio.seek(seconds)
    }

    static setVolume(volume) {
        if (NativeAudio) NativeAudio.setVolume(volume)
    }

    static setRemoteControlMode(enabled, initialVolume = 1.0, baseUrl = '', authToken = '', sessionId = '') {
        if (!NativeAudio) return
        NativeAudio.setRemoteControlMode({
            enabled: enabled,
            initialVolume: initialVolume,
            baseUrl: baseUrl,
            authToken: authToken,
            sessionId: String(sessionId || '')
        })
    }

    static syncRemoteVolume(volume) {
        if (NativeAudio) NativeAudio.syncRemoteVolume(volume)
    }

    static addListener(eventName, listener) {
        if (!emitter) return { remove: () => { } }
        return emitter.addListener(eventName, listener)
    }

    static updateMetadata(params) {
        if (!NativeAudio) return
        NativeAudio.updateMetadata({
            title: params.title || '',
            artist: params.artist || '',
            album: params.album || '',
            artworkUrl: params.artworkUrl || '',
            duration: params.duration || 0,
            isPlaying: params.isPlaying || false
        })
    }

    static requestQueueSync() {
        if (NativeAudio) NativeAudio.requestQueueSync()
    }

    static configureApi(baseUrl, token, sessionId) {
        if (NativeAudio) {
            const resolvedSessionId = sessionId != null ? String(sessionId) : null
            NativeAudio.configureApi(baseUrl, token, resolvedSessionId)
        }
    }
}