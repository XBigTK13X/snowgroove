import { C, useAppContext } from 'snowgroove'

function DeviceGroup(props) {
    const { routes } = useAppContext()
    const { navPush } = C.useSnowContext(props)
    return (
        <C.SnowView>
            <C.SnowLabel center>{props.title}</C.SnowLabel>
            <C.SnowGrid {...props} items={props.items} renderItem={(remotePlayer) => {
                return (
                    <C.SnowTextButton title={remotePlayer.name} onPress={navPush({
                        path: routes.deviceDetails,
                        params: {
                            remotePlayerId: remotePlayer.id
                        }
                    })} />
                )
            }} />
        </C.SnowView>
    )
}

export default function DeviceListPage(props) {
    const { apiClient } = useAppContext()
    const [remotePlayers, setRemotePlayers] = C.React.useState(null)
    const [canStopAll, setCanStopAll] = C.React.useState(null)

    C.React.useEffect(() => {
        apiClient.getRemotePlayerList().then((response) => {
            setRemotePlayers(response.player_list)
            setCanStopAll(response.can_stop_all)
        })
    }, [])


    if (!remotePlayers) {
        return <C.SnowLabel center>Loading devices...</C.SnowLabel>
    }

    if (!remotePlayers?.length) {
        return <C.SnowLabel center>No devices found. Try running a scan.</C.SnowLabel>
    }

    let speakers = remotePlayers.filter(xx => !xx.name.includes('yTV') && !xx.name.includes('zGroup'))
    let groups = remotePlayers
        .filter(xx => xx.name.includes('zGroup'))
        .map(xx => ({
            ...xx,
            name: xx.name.replace('zGroup - ', '')
        }))
    return (
        <C.SnowView {...props}>

            {canStopAll ? <C.SnowGrid itemsPerRow={1}><C.SnowTextButton title="Stop All" onPress={() => {
                apiClient.stopAllRemotePlayers()
            }} /></C.SnowGrid> : null}
            {speakers?.length ? <DeviceGroup focusStart focusKey="speakers" title="Speakers" items={speakers} /> : null}
            {speakers?.length && groups?.length ? <C.SnowBreak /> : null}
            {groups?.length ? <DeviceGroup focusStart={!speakers?.length} focusKey="groups" title="Groups" items={groups} /> : null}
        </C.SnowView>

    )
}
