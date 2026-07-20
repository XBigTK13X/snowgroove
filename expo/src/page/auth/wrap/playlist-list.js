import { C, useAppContext } from 'snowgroove'

export default function PlaylistListPage() {
    const { apiClient, routes } = useAppContext()
    const { navPush } = C.useSnowContext()
    const [playlistList, setPlaylistList] = C.React.useState(null)

    C.React.useEffect(() => {
        if (!playlistList) {
            apiClient.getPlaylistList().then((response) => {
                setPlaylistList(response)
            })
        }
    }, [playlistList])
    if (playlistList === null) {
        return <C.SnowLabel center> Loading playlist list.</C.SnowLabel>
    }

    if (!playlistList?.owners?.length) {
        return <C.SnowLabel center>No playlists found.</C.SnowLabel>
    }

    return (
        <C.SnowTabs focusStart focusKey="playlists" headers={playlistList.owners}>
            {playlistList.owners.map((owner) => {
                return <C.SnowGrid items={playlistList.playlists[owner]} renderItem={(playlist) => {
                    return (
                        <C.SnowTextButton title={playlist.name} onPress={navPush({
                            path: routes.playlistDetails,
                            params: {
                                playlistName: playlist.name,
                                playlistId: playlist.id
                            }
                        })} />
                    )
                }} />
            })}
        </C.SnowTabs>
    )
}
