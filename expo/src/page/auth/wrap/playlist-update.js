import { C, useAppContext, useAudioContext } from 'snowgroove'

export default function PlaylistUpdatePage() {
    const { navPush, toast } = C.useSnowContext()
    const { apiClient, routes } = useAppContext()
    const { musicSession } = useAudioContext()

    const [playlistList, setPlaylistList] = C.React.useState(null)
    const [playlistName, setPlaylistName] = C.React.useState('')
    const playlistNameRef = C.React.useRef(null)

    C.React.useEffect(() => {
        if (!playlistList) {
            apiClient.getPlaylistList().then((response) => {
                setPlaylistList(response)
            })
        }
    }, [playlistList])

    C.React.useEffect(() => {
        playlistNameRef.current = playlistName
    }, [playlistName])

    if (playlistList === null) {
        return <C.SnowLabel center>Loading playlist list.</C.SnowLabel>
    }

    const saveQueueAsPlaylist = (saveId, saveName) => {
        if (musicSession?.music_queue?.songs?.length) {
            apiClient.updatePlaylist(saveId, saveName, musicSession?.music_queue?.songs?.map(xx => xx.fingerprint)).then((response) => {
                navPush({
                    path: routes.playlistDetails,
                    params: {
                        playlistId: response.id,
                        playlistName: response.name
                    },
                    func: false
                })
            })
        } else {
            toast.show(`The queue is empty, did not save playlist [${saveName}].`, {
                duration: 1000,
                position: 'bottom',
            });
        }
    }

    let playlistPicker = null
    if (playlistList?.length) {
        playlistPicker = (
            <C.SnowView>
                <C.SnowLabel center>Overwrite an existing playlist.</C.SnowLabel>
                <C.SnowGrid focusKey="overwrite-playlist" items={playlistList} renderItem={(item) => {
                    return (
                        <C.SnowTextButton title={item.name} onPress={() => {
                            saveQueueAsPlaylist(item.id, item.name)
                        }} />
                    )
                }} />
            </C.SnowView>
        )
    } else {
        playlistPicker = <C.SnowLabel center>No playlists found.</C.SnowLabel>
    }

    return (
        <C.SnowView>
            <C.SnowLabel center>Create a new playlist.</C.SnowLabel>
            <C.SnowGrid focusKey="create-playlist" itemsPerRow={2}>
                <C.SnowInput value={playlistName} onValueChange={setPlaylistName} />
                <C.SnowTextButton short disabled={playlistName === ''} title="Create" onPress={() => {
                    saveQueueAsPlaylist(null, playlistNameRef.current)
                }} />
            </C.SnowGrid>
            {playlistPicker}
        </C.SnowView>
    )
}
