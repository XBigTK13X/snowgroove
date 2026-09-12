import { requireNativeModule } from 'expo-modules-core'
import { Platform } from 'react-native'

const createCrossControls = () => {
    const CrossAudio = require('./cross/cross-audio-controls.js').default

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

    CrossAudio.setEventEmitter(crossEmitter)

    return class CrossPlatformAudioControls {
        static emitter = crossEmitter

        static addListener(eventName, listener) {
            return crossEmitter.addListener(eventName, listener)
        }

        static configureApi(apiClient) {
            CrossAudio.configureApi(apiClient)
        }

        static changeTargetPlayer(name, id) {
            CrossAudio.changeTargetPlayer(name, id)
        }

        static play(audioFile) {
            CrossAudio.play(audioFile)
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

    return class SnowAudioControlsAndroid {
        static addListener(eventName, listener) {
            return nativeAudio.addListener(eventName, listener)
        }

        static configureApi(apiClient) {
            nativeAudio.configureApi(apiClient.baseURL, apiClient.authToken)
        }

        static changeTargetPlayer(id, name) {
            nativeAudio.changeTargetPlayer(id, name)
        }

        static play(audioFile) {
            nativeAudio.play(audioFile)
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