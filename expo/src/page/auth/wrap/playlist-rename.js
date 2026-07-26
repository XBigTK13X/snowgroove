import { C, useAppContext } from 'snowgroove'

export default function PlaylistRenamePage() {
    const { navPush, currentRoute } = C.useSnowContext()
    const { apiClient, routes } = useAppContext()

    const [playlistList, setPlaylistList] = C.React.useState(null)
    const [playlistName, setPlaylistName] = C.React.useState('')
    const playlistNameRef = C.React.useRef(null)

    C.React.useEffect(() => {
        if (!playlistList) {
            apiClient.getPlaylistList(true).then((response) => {
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

    const renamePlaylist = (saveName) => {
        apiClient.updatePlaylist(currentRoute?.routeParams?.playlistId, saveName, null).then((response) => {
            if (response?.error) {
                toast.show(response.error, {
                    duration: 1000,
                    position: 'bottom',
                });
            } else {
                navPush({
                    path: routes.playlistDetails,
                    params: {
                        playlistId: response.id,
                        playlistName: response.name
                    },
                    func: false
                })
            }
        })
    }

    return (
        <C.SnowView>
            <C.SnowLabel center>Enter a new name for playlist [{currentRoute?.routeParams?.playlistName}].</C.SnowLabel>
            <C.SnowGrid focusKey="create-playlist" itemsPerRow={2}>
                <C.SnowInput value={playlistName} onValueChange={setPlaylistName} />
                <C.SnowTextButton
                    short
                    disabled={playlistName === ''} title="Rename"
                    onPress={() => {
                        renamePlaylist(playlistNameRef.current)
                    }}
                />
            </C.SnowGrid>
        </C.SnowView>
    )
}
