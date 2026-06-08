import { C, useAppContext, useAudioContext } from 'snowgroove'
import Snow from 'expo-snowui'

export default function DeviceListPage(props) {
    const { apiClient, routes, config } = useAppContext()
    const { SnowStyle, navPush } = C.useSnowContext(props)
    const [remotePlayers, setRemotePlayers] = C.React.useState(null)

    C.React.useEffect(() => {
        apiClient.getRemotePlayerList().then((response) => {
            setRemotePlayers(response)
        })
    }, [])


    if (!remotePlayers) {
        return <C.SnowLabel center>Loading devices...</C.SnowLabel>
    }

    return (
        <C.SnowGrid items={remotePlayers} renderItem={(remotePlayer) => {
            return (
                <C.SnowTextButton title={remotePlayer.name} onPress={navPush({
                    path: routes.deviceDetails,
                    params: {
                        remotePlayerId: remotePlayer.id
                    }
                })} />
            )
        }} />
    )
}
