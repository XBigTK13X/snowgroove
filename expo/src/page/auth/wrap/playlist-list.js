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

    if (!playlistList?.length) {
        return <C.SnowLabel center>No playlists found.</C.SnowLabel>
    }

    return (
        <C.SnowGrid items={playlistList} renderItem={(item) => {
            return (
                <C.SnowTextButton title={item.name} onPress={navPush({
                    path: routes.playlistDetails,
                    params: {
                        playlistName: item.name,
                        playlistId: item.id
                    }
                })} />
            )
        }} />
    )
}
