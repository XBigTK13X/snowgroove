import { C, useAppContext, useAudioContext } from 'snowgroove'

export default function PlaylistDetailsPage() {
    const { currentRoute, navPush } = C.useSnowContext()
    const { apiClient, routes } = useAppContext()
    const { addAudioFileListToQueue } = useAudioContext()

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
            <C.SnowGrid>
                <C.SnowTextButton title="Add Playlist to Queue" onPress={() => {
                    addAudioFileListToQueue(playlist?.audio_files)
                }} />
            </C.SnowGrid>
            <C.SnowLabel center>Found {playlist.audio_files.length} items from playlist {currentRoute?.routeParams?.playlistName}.</C.SnowLabel>
            <C.SnowSongList disableDrag audioFiles={playlist.audio_files} />
        </C.SnowView>
    )
}
