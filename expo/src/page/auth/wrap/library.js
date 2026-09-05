import { C, useAppContext } from 'snowgroove'
import Snow from 'expo-snowui'
const snowuiPackageInfo = require('expo-snowui/package.json')

export default function LibraryPage(props) {
    const { apiClient, routes, config, targetPlayer } = useAppContext()
    const { SnowStyle, navPush } = C.useSnowContext(props)
    const [shelves, setShelves] = C.React.useState(null)

    C.React.useEffect(() => {
        if (config.debugVideoUrl) {
            const parts = config.debugVideoUrl.split('?')
            const payload = {
                path: parts[0],
                params: Snow.queryToObject(parts[1]),
                func: false
            }
            navPush(payload)
        }
    }, [config])

    C.React.useEffect(() => {
        apiClient.getShelfList().then((response) => {
            setShelves(response)
        })
    }, [])

    let destinations = [
        <C.SnowTextButton title="Playlists" onPress={navPush({ path: routes.playlistList })} />,
        <C.SnowTextButton title="Search" onPress={navPush({ path: routes.search })} />,
    ]

    if (shelves) {
        destinations = (shelves.map((shelf) => {
            return (
                <C.SnowTextButton
                    title={"Browse"}
                    onPress={navPush({ path: routes.crateDetails, params: { shelfId: shelf.id } })}
                />
            )
        })).concat(destinations)
    }
    if (shelves !== null) {
        return (
            <C.SnowView {...props}>
                <C.SnowLabel center>Library</C.SnowLabel>
                <C.SnowGrid
                    yy={4}
                    focusStart
                    focusKey="destinations"
                    itemsPerRow={2}>
                    {destinations}
                </C.SnowGrid>
            </C.SnowView>
        )
    }

    return (
        <C.SnowText center>
            Loading content from [{apiClient.webApiUrl}] v{config.clientVersion}
        </C.SnowText>
    )
}
