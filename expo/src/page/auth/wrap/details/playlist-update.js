import { C, useAppContext, useAudioContext } from 'snowgroove'

export default function PlaylistUpdatePage() {
    const { navPush } = C.useSnowContext()
    const { apiClient, routes } = useAppContext()
    const { musicSession } = useAudioContext()

    const [playlistList, setPlaylistList] = C.React.useState(null)
    const [playlistName, setPlaylistName] = C.React.useState('')

    C.React.useEffect(() => {
        if (!playlistList) {
            apiClient.getPlaylistList().then((response) => {
                setPlaylistList(response)
            })
        }
    }, [playlistList])
    if (playlistList === null) {
        return <C.SnowLabel center>Loading playlist list.</C.SnowLabel>
    }

    if (!playlistList?.length) {

    }

    let playlistPicker = null
    if (playlistList?.length) {
        playlistPicker = (<C.SnowGrid items={playlistList} renderItem={(item) => {
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
    } else {
        playlistPicker = <C.SnowLabel center>No playlists found.</C.SnowLabel>
    }

    return (
        <C.SnowView>
            <C.SnowGrid itemsPerRow={2}>
                <C.SnowInput value={playlistName} onValueChange={setPlaylistName} />
                <C.SnowTextButton disabled={playlistName === ''} title="Create New Playlist" onPress={() => {

                }} />
            </C.SnowGrid>
            {playlistPicker}
        </C.SnowView>
    )
}
