import { C, useAppContext, useAudioContext } from 'snowgroove'
import Snow from 'expo-snowui'

export default function DeviceDetailsPage(props) {
    const { apiClient, changeTargetPlayer, routes } = useAppContext()
    const { SnowStyle, navPush, currentRoute } = C.useSnowContext(props)
    const [remotePlayer, setRemotePlayer] = C.React.useState(null)

    C.React.useEffect(() => {
        apiClient.getRemotePlayer(currentRoute?.routeParams?.remotePlayerId).then((response) => {
            setRemotePlayer(response)
        })
    }, [])


    if (!remotePlayer) {
        return <C.SnowLabel center>Loading device...</C.SnowLabel>
    }

    let musicQueue = null
    if (remotePlayer?.music_queue) {

    } else {
        musicQueue = (
            <C.SnowText center>The queue on this device is currently empty.</C.SnowText>
        )
    }


    return (
        <C.SnowView {...props}>
            <C.SnowText center>{remotePlayer.name}</C.SnowText>
            <C.SnowText center>{remotePlayer.device_make}</C.SnowText>
            <C.SnowGrid>
                <C.SnowTextButton focusStart title="Target This Device" onPress={() => {
                    changeTargetPlayer(remotePlayer.id, remotePlayer.name).then(() => {
                        navPush({
                            path: routes.musicSessionDetails,
                            func: false
                        })
                    })
                }} />
            </C.SnowGrid>
            {musicQueue}
        </C.SnowView>
    )
}
