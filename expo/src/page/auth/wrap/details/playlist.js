import { C, useAppContext } from 'snowgroove'

export default function PlaylistDetailsPage() {
    const { currentRoute, navPush } = C.useSnowContext()
    const { apiClient, routes } = useAppContext()

    const [playlist, setPlaylist] = C.React.useState(null)

    C.React.useEffect(() => {
        apiClient.getPlaylist(currentRoute?.routeParams?.playlistId).then((response) => {
            setPlaylist(response)
        })
    }, [])

    if (!playlist) {
        return <C.Text>Loading playlist {currentRoute?.routeParams?.playlistName}.</C.Text>
    }

    return (
        <C.SnowView>
            <C.SnowText center>Found {playlist.audio_files.length} items from playlist {currentRoute?.routeParams?.playlistName}.</C.SnowText>
            <C.SnowSongList disableDrag audioFiles={playlist.audio_files} />
        </C.SnowView>
    )
}
