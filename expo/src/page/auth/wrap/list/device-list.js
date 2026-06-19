import { C, useAppContext, useAudioContext } from 'snowgroove'
import Snow from 'expo-snowui'

function DeviceGroup(props) {
    const { routes } = useAppContext()
    const { navPush } = C.useSnowContext(props)
    return (
        <>
            <C.SnowLabel center>{props.title}</C.SnowLabel>
            <C.SnowGrid items={props.items} renderItem={(remotePlayer) => {
                return (
                    <C.SnowTextButton title={remotePlayer.name} onPress={navPush({
                        path: routes.deviceDetails,
                        params: {
                            remotePlayerId: remotePlayer.id
                        }
                    })} />
                )
            }} />
        </>
    )
}

export default function DeviceListPage(props) {
    const { apiClient } = useAppContext()
    const [remotePlayers, setRemotePlayers] = C.React.useState(null)

    C.React.useEffect(() => {
        apiClient.getRemotePlayerList().then((response) => {
            setRemotePlayers(response)
        })
    }, [])


    if (!remotePlayers) {
        return <C.SnowLabel center>Loading devices...</C.SnowLabel>
    }

    if (!remotePlayers?.length) {
        return <C.SnowLabel center>No devices found. Try running a scan.</C.SnowLabel>
    }

    let speakers = remotePlayers.filter(xx => !xx.name.includes('yTV') && !xx.name.includes('zGroup'))
    let groups = remotePlayers.filter(xx => xx.name.includes('zGroup')).map(xx => { xx.name = xx.name.replace('zGroup - ', ''); return xx })
    return (
        <>
            <DeviceGroup title="Speakers" items={speakers} />
            <DeviceGroup title="Groups" items={groups} />
        </>

    )
}
