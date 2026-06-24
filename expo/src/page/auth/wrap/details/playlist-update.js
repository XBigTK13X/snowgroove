import { C, useAppContext, useAudioContext } from 'snowgroove'

export default function PlaylistUpdatePage() {
    const { navPush, toast } = C.useSnowContext()
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

    const saveQueueAsPlaylist = (playlistId, playlistName) => {
        if (musicSession?.music_queue?.songs?.length) {
            apiClient.updatePlaylist(playlistId, playlistName, musicSession?.music_queue?.songs?.map(xx => xx.fingerprint))
        } else {
            toast.show(`The queue is empty, did not save playlist [${playlistName}].`, {
                duration: 1000,
                position: 'bottom',
            });
        }
    }

    let playlistPicker = null
    if (playlistList?.length) {
        playlistPicker = (<C.SnowGrid items={playlistList} renderItem={(item) => {
            return (
                <C.SnowTextButton title={item.name} onPress={() => {
                    saveQueueAsPlaylist(item.id, item.name)
                }} />
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
                    saveQueueAsPlaylist(null, playlistName)
                }} />
            </C.SnowGrid>
            {playlistPicker}
        </C.SnowView>
    )
}
