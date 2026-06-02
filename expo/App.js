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
