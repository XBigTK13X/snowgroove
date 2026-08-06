import { LogBox } from 'react-native'

LogBox.ignoreLogs([
    /VirtualizedLists should never be nested/
])

const originalError = console.error
console.error = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes('VirtualizedLists should never be nested')) {
        return
    }
    originalError(...args)
}

import { Audio } from 'expo-av'
import PageLoader from "./src/page/page-loader";

Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    staysActiveInBackground: true,
    playsInSilentModeIOS: true,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
}).catch((error) => {
    console.error('Failed to set global audio mode:', error)
})

export default PageLoader;
