import { requireNativeModule } from 'expo-modules-core'
import { Platform } from 'react-native'

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

const initializeDriver = () => {
    if (Platform.OS === 'android') {
        const nativeAudio = requireNativeModule('SnowAudioControls')
        return {
            backend: nativeAudio,
            emitter: nativeAudio,
            configureApi: (apiClient) => nativeAudio.configureApi(apiClient.baseURL, apiClient.authToken)
        }
    }

    const crossAudio = require('./cross/cross-audio-controls.js').default
    const crossEmitter = new SimpleEventEmitter()
    crossAudio.setEventEmitter(crossEmitter)

    return {
        backend: crossAudio,
        emitter: crossEmitter,
        configureApi: (apiClient) => crossAudio.configureApi(apiClient)
    }
}

const driver = initializeDriver()

const forwardMethods = [
    'addToQueue',
    'changeTargetPlayer',
    'clearQueue',
    'moveCurrentIndex',
    'moveQueueItem',
    'pause',
    'play',
    'playNext',
    'removeFromQueue',
    'resume',
    'seek',
    'setVolume',
    'shuffleQueue',
    'stop',
]

export class SnowAudioControls {
    static emitter = driver.emitter

    static addListener(eventName, listener) {
        return driver.emitter.addListener(eventName, listener)
    }

    static configureApi(apiClient) {
        driver.configureApi(apiClient)
    }
}

for (const methodName of forwardMethods) {
    SnowAudioControls[methodName] = (...args) => {
        return driver.backend[methodName](...args)
    }
}