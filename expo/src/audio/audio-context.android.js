import React from 'react'
import { AudioContext, useAudioContext, useAudioContextBase } from './audio-context-base'
import { config } from '../settings'
import { SnowAudioControls } from '../../modules/snow-audio-controls'

import { util } from 'expo-snowui'

export { useAudioContext }

export function AudioContextProvider({ children }) {
    const {
        apiClient,
        playbackState,
        setPlaybackState,
        sessionRef,
        handler,
        moveCurrentIndex,
        togglePlayback,
        contextValue
    } = useAudioContextBase()

    React.useEffect(() => {
        if (apiClient?.baseURL && apiClient?.authToken) {
            SnowAudioControls.configureApi(
                apiClient.baseURL,
                apiClient.authToken,
                sessionRef.current?.id || null
            )
        }
    }, [apiClient?.baseURL, apiClient?.authToken])

    React.useEffect(() => {
        if (playbackState.musicSession?.music_queue) {
            SnowAudioControls.requestQueueSync()
        }
    }, [playbackState.musicSession])

    React.useEffect(() => {
        const subscriptions = [
            SnowAudioControls.addListener('play', () => {
                if (config.debugAndroidAudio) util.prettyLog({ owner: 'audio-context', action: 'play' })
                togglePlayback()
            }),
            SnowAudioControls.addListener('pause', () => {
                if (config.debugAndroidAudio) util.prettyLog({ owner: 'audio-context', action: 'pause' })
                togglePlayback()
            }),
            SnowAudioControls.addListener('next', () => {
                if (config.debugAndroidAudio) util.prettyLog({ owner: 'audio-context', action: 'next' })
                moveCurrentIndex(1)
            }),
            SnowAudioControls.addListener('previous', () => {
                if (config.debugAndroidAudio) util.prettyLog({ owner: 'audio-context', action: 'previous' })
                moveCurrentIndex(-1)
            }),
            SnowAudioControls.addListener('seek', (event) => {
                if (config.debugAndroidAudio) util.prettyLog({ owner: 'audio-context', action: 'seek', event })
                handler.seek(event.position)
            }),
            SnowAudioControls.addListener('volumeAdjust', (event) => {
                if (config.debugAndroidAudio) util.prettyLog({ owner: 'audio-context', action: 'volumeAdjust', event })
                handler.setVolume(event.percent)
            }),
            SnowAudioControls.addListener('queueStale', () => {
                if (config.debugAndroidAudio) util.prettyLog({ owner: 'audio-context', action: 'queueStale' })
                handler.refreshSession()
            }),
            SnowAudioControls.addListener('trackChanged', (event) => {
                if (config.debugAndroidAudio) util.prettyLog({ owner: 'audio-context', action: 'trackChanged', event })
                const songs = sessionRef.current?.music_queue?.songs
                if (event?.songFingerprint && songs) {
                    const songIndex = songs.findIndex((song) => song.fingerprint === event.songFingerprint)
                    if (songIndex !== -1) {
                        setPlaybackState((prev) => ({
                            ...prev,
                            currentAudioFile: songs[songIndex],
                            positionSeconds: 0,
                            isPlaying: true
                        }))
                    }
                }
            }),
            SnowAudioControls.addListener('log', (event) => {
                if (config.debugAndroidAudio) util.prettyLog({ owner: 'audio-context', action: 'log', event })
            })
        ]

        return () => {
            for (let ii = 0; ii < subscriptions.length; ii++) {
                subscriptions[ii].remove()
            }
        }
    }, [handler, togglePlayback, moveCurrentIndex])

    return (
        <AudioContext.Provider value={contextValue}>
            {children}
        </AudioContext.Provider>
    )
}