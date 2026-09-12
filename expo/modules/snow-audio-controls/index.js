import { requireNativeModule, EventEmitter } from 'expo-modules-core'
import { Platform } from 'react-native'

const createCrossControls = () => {
    const CrossAudio = require('./audio-controls.js')()

    class SimpleEventEmitter {
        listeners = new Map()

        addListener(eventName, listener) {
            if (!this.listeners.has(eventName)) {
                this.listeners.set(eventName, new Set())
            }

            const listenersForEvent = this.listeners.get(eventName)
            listenersForEvent.add(listener)

            return {
                remove: () => {
                    listenersForEvent.delete(listener)
                    if (listenersForEvent.size === 0) {
                        this.listeners.delete(eventName)
                    }
                }
            }
        }

        emit(eventName, ...args) {
            const listenersForEvent = this.listeners.get(eventName)
            if (!listenersForEvent) return
            for (const listener of listenersForEvent) {
                listener(...args)
            }
        }

        removeAllListeners(eventName) {
            if (eventName) {
                this.listeners.delete(eventName)
            } else {
                this.listeners.clear()
            }
        }
    }

    const crossEmitter = new SimpleEventEmitter()

    return class CrossPlatformAudioControls {
        static emitter = crossEmitter

        static addListener(eventName, listener) {
            return crossEmitter.addListener(eventName, listener)
        }

        static configureApi(baseUrl, token) {
            CrossAudio.configureApi(baseUrl, token)
        }

        static changeTargetPlayer(name, id) {
            CrossAudio.changeTargetPlayer(name, id)
        }

        static loadMusicSession(remoteDeviceId) {
            CrossAudio.loadMusicSession(remoteDeviceId)
        }

        static play() {
            CrossAudio.play()
        }

        static resume() {
            CrossAudio.resume()
        }

        static pause() {
            CrossAudio.pause()
        }

        static stop() {
            CrossAudio.stop()
        }

        static seek(seconds) {
            CrossAudio.seek(seconds)
        }

        static setVolume(volume) {
            CrossAudio.setVolume(volume)
        }

        static syncRemoteVolume(volume) {
            CrossAudio.syncRemoteVolume(volume)
        }

        static updateMetadata() {
            CrossAudio.updateMetadata()
        }
    }
}

const createAndroidControls = () => {
    const nativeAudio = requireNativeModule('SnowAudioControls')
    const nativeEmitter = new EventEmitter(nativeAudio)

    return class SnowAudioControlsAndroid {
        static emitter = nativeEmitter

        static addListener(eventName, listener) {
            return nativeEmitter.addListener(eventName, listener)
        }

        static configureApi(baseUrl, token) {
            nativeAudio.configureApi(baseUrl, token)
        }

        static changeTargetPlayer(id, name) {
            nativeAudio.changeTargetPlayer(id, name)
        }

        static loadMusicSession(remoteDeviceId) {
            nativeAudio.loadMusicSession(remoteDeviceId)
        }

        static play() {
            nativeAudio.play()
        }

        static resume() {
            nativeAudio.resume()
        }

        static pause() {
            nativeAudio.pause()
        }

        static stop() {
            nativeAudio.stop()
        }

        static seek(seconds) {
            nativeAudio.seek(seconds)
        }

        static setVolume(volume) {
            nativeAudio.setVolume(volume)
        }

        static syncRemoteVolume(volume) {
            nativeAudio.syncRemoteVolume(volume)
        }

        static updateMetadata() {
            nativeAudio.updateMetadata()
        }
    }
}

export const SnowAudioControls = Platform.OS === 'android'
    ? createAndroidControls()
    : createCrossControls()