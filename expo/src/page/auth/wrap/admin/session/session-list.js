import { C, useAppContext } from 'snowgroove'

export default function SessionListPage() {
    const { apiClient } = useAppContext()
    const [sessions, setSessions] = C.React.useState(null)
    C.React.useEffect(() => {
        if (!sessions) {
            apiClient.getMusicSessionList().then((response) => {
                setSessions(response)
            })
        }
    }, [])

    if (sessions === null) {
        return <C.SnowLabel center>Loading sessions...</C.SnowLabel>
    }

    if (!sessions.length) {
        return <C.SnowLabel center>No sessions found</C.SnowLabel>
    }

    let userSessions = sessions.filter(xx => xx.client_device_user)
    let remoteSessions = sessions.filter(xx => xx.remote_player)

    let userList = <C.SnowText>No user sessions</C.SnowText>
    if (userSessions?.length) {
        userList = (
            <>
                <C.SnowLabel>User Sessions</C.SnowLabel>
                <C.SnowGrid itemsPerRow={1}>
                    {userSessions.map((session, sessionIndex) => {
                        return (
                            <C.SnowText key={sessionIndex}>{C.Snow.stringifySafe(session)}</C.SnowText>
                        )
                    })}
                </C.SnowGrid>
            </>
        )
    }
    let remoteList = <C.SnowText>No remote sessions</C.SnowText>
    if (remoteSessions?.length) {
        remoteList = (
            <>
                <C.SnowLabel>Remote Sessions</C.SnowLabel>
                <C.SnowGrid>
                    {remoteSessions.map((session, sessionIndex) => {
                        return (
                            <C.SnowText key={sessionIndex}>{C.Snow.stringifySafe(session)}</C.SnowText>
                        )
                    })}
                </C.SnowGrid>
            </>
        )
    }
    return (
        <>
            {userList}
            {remoteList}
        </>
    )
}
