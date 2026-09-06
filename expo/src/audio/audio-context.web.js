import React from 'react'
import { AudioContext, useAudioContext, useAudioContextBase } from './audio-context-base'

export { useAudioContext }

export function AudioContextProvider({ children }) {
    const { contextValue } = useAudioContextBase()

    return (
        <AudioContext.Provider value={contextValue}>
            {children}
        </AudioContext.Provider>
    )
}