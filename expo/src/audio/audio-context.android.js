import React from 'react'
import { AudioContext, useAudioContext, useAudioContextBase } from './audio-context-base'
import { SnowAudioControls } from '../../modules/snow-audio-controls'

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
            SnowAudioControls.addListener('play', togglePlayback),
            SnowAudioControls.addListener('pause', togglePlayback),
            SnowAudioControls.addListener('next', () => moveCurrentIndex(1)),
            SnowAudioControls.addListener('previous', () => moveCurrentIndex(-1)),
            SnowAudioControls.addListener('seek', (event) => {
                if (event?.position !== undefined) handler.seek(event.position)
            }),
            SnowAudioControls.addListener('volumeAdjust', (event) => {
                if (event?.percent !== undefined) handler.setVolume(event.percent)
            }),
            SnowAudioControls.addListener('queueStale', () => handler.refreshSession()),
            SnowAudioControls.addListener('trackChanged', (event) => {
                const songs = sessionRef.current?.music_queue?.songs
                if (event?.songId && songs) {
                    const songIndex = songs.findIndex((song) => song.id === event.songId)
                    if (songIndex !== -1) {
                        setPlaybackState((prev) => ({
                            ...prev,
                            currentAudioFile: songs[songIndex],
                            positionSeconds: 0,
                            isPlaying: true
                        }))
                    }
                }
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