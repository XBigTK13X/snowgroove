import { C, useAppContext } from 'snowgroove'

function DeviceGroup(props) {
    const { routes } = useAppContext()
    const { navPush } = C.useSnowContext(props)
    return (
        <C.SnowView>
            <C.SnowLabel center>{props.title}</C.SnowLabel>
            <C.SnowGrid {...props} items={props.items} renderItem={(remotePlayer) => {
                let title = remotePlayer.name
                if (remotePlayer.is_online === false) {
                    title = `${remotePlayer.name}\n[offline]`
                }
                else if (remotePlayer.is_playing === true) {
                    title = `${remotePlayer.name}\n[playing]`
                }
                else if (remotePlayer.is_playing === false && remotePlayer?.has_session) {
                    title = `${remotePlayer.name}\n[paused]`
                }

                return (
                    <C.SnowTextButton title={title} onPress={navPush({
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
    const [scanJob, setScanJob] = C.React.useState(null)
    const [dotCount, setDotCount] = C.React.useState(0)
    const [isScanning, setIsScanning] = C.React.useState(false)

    const fetchPlayers = () => {
        apiClient.getRemotePlayerList().then((response) => {
            setRemotePlayers(response.player_list)
            setCanStopAll(response.can_stop_all)
        })
    }

    C.React.useEffect(() => {
        fetchPlayers()
    }, [])

    C.React.useEffect(() => {
        if (!isScanning) {
            return
        }

        const intervalIdentifier = setInterval(() => {
            setDotCount((previousCount) => (previousCount + 1) % 4)
        }, 500)

        return () => clearInterval(intervalIdentifier)
    }, [isScanning])

    const pollJobStatus = (jobIdentifier) => {
        apiClient.getJob(jobIdentifier).then((response) => {
            setScanJob(response)

            if (response.status === 'running' || response.status === 'pending') {
                setTimeout(() => pollJobStatus(jobIdentifier), 2500)
            } else {
                setIsScanning(false)
                fetchPlayers()
            }
        })
    }

    const handleStartScan = () => {
        setIsScanning(true)
        setDotCount(0)

        apiClient.createJobRemotePlayersScan().then((response) => {
            setScanJob(response)
            if (response.status === 'running' || response.status === 'pending') {
                setTimeout(() => pollJobStatus(response.id), 2500)
            } else {
                setIsScanning(false)
                fetchPlayers()
            }
        })
    }

    const resolveScanTitle = () => {
        if (isScanning) {
            return `Scanning${'.'.repeat(dotCount)}`
        }

        if (!scanJob) {
            return 'Scan Network'
        }

        if (scanJob.status === 'completed' || scanJob.status === 'success') {
            return 'Scan Complete'
        }

        if (scanJob.status === 'failed' || scanJob.status === 'error') {
            return 'Scan Failed'
        }

        return 'Scan Network'
    }

    if (!remotePlayers) {
        return <C.SnowLabel center>Loading devices...</C.SnowLabel>
    }

    if (!remotePlayers?.length) {
        return <C.SnowLabel center>No devices found. Try running a scan.</C.SnowLabel>
    }

    let systemControls = null
    if (canStopAll) {
        systemControls = (
            <C.SnowGrid>
                <C.SnowTextButton title="Stop All" onPress={() => {
                    apiClient.stopAllRemotePlayers()
                }} />
                <C.SnowTextButton
                    title={resolveScanTitle()}
                    disabled={isScanning}
                    onPress={handleStartScan}
                />
            </C.SnowGrid>
        )
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
            {systemControls}
            <C.SnowGrid itemsPerRow={1}>
                {speakers?.length ? <DeviceGroup focusStart focusKey="speakers" title="Speakers" items={speakers} /> : null}
                {speakers?.length && groups?.length ? <C.SnowBreak /> : null}
                {groups?.length ? <DeviceGroup focusStart={!speakers?.length} focusKey="groups" title="Groups" items={groups} /> : null}
            </C.SnowGrid>
        </C.SnowView>
    )
}