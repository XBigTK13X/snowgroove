import Snow from 'expo-snowui'
import { C, useAppContext } from 'snowgroove'

export default function UserEditPage() {
    const { navPush, currentRoute } = Snow.useSnowContext()
    const { apiClient, routes } = useAppContext()

    const [userId, setUserId] = C.React.useState(null)
    const [userTags, setUserTags] = C.React.useState([])
    const [userShelves, setUserShelves] = C.React.useState([])
    const [userRemotePlayers, setUserRemotePlayers] = C.React.useState([])

    const [tags, setTags] = C.React.useState('')
    const [shelves, setShelves] = C.React.useState('')
    const [remotePlayers, setRemotePlayers] = C.React.useState('')

    C.React.useEffect(() => {
        apiClient.getUser(currentRoute.routeParams.userId).then((response) => {
            setUserId(currentRoute.routeParams.userId)
            if (response.access_tags) {
                setUserTags(response.access_tags.map(item => item.id))
                setUserShelves(response.access_shelves.map(item => item.id))
                setUserRemotePlayers(response.access_remote_players.map(item => item.id))
            }
        })
        apiClient.getTagList().then((response) => {
            setTags(response)
        })
        apiClient.getShelfList().then((response) => {
            setShelves(response)
        })
        apiClient.getRemotePlayerList().then((response) => {
            setRemotePlayers(response)
        })
    }, [])

    const saveUserAccess = () => {
        let payload = {
            userId: userId,
            tagIds: userTags,
            shelfIds: userShelves,
            remotePlayerIds: userRemotePlayers
        }
        apiClient.saveUserAccess(payload)
    }

    const setShelfAccess = (shelfId, accessible) => {
        if (!accessible) {
            const shelfIndex = userShelves.indexOf(shelfId)
            if (shelfIndex !== -1) {
                let moddedUserShelves = [...userShelves]
                moddedUserShelves.splice(shelfIndex, 1)
                setUserShelves(moddedUserShelves)
            }
        }
        if (accessible) {
            const shelfIndex = userShelves.indexOf(shelfId)
            if (shelfIndex === -1) {
                let modduedUserShelves = [...userShelves]
                modduedUserShelves.push(shelfId)
                setUserShelves(modduedUserShelves)
            }
        }
    }

    const setTagAccess = (tagId, accessible) => {
        if (!accessible) {
            const tagIndex = userTags.indexOf(tagId)
            if (tagIndex !== -1) {
                let moddedUserTags = [...userTags]
                moddedUserTags.splice(tagIndex, 1)
                setUserTags(moddedUserTags)
            }
        }
        if (accessible) {
            const tagIndex = userTags.indexOf(tagId)
            if (tagIndex === -1) {
                let moddedUserTags = [...userTags]
                moddedUserTags.push(tagId)
                setUserTags(moddedUserTags)
            }
        }
    }

    const setRemotePlayerAccess = (remotePlayerId, accessible) => {
        if (!accessible) {
            const playerIndex = userRemotePlayers.indexOf(remotePlayerId)
            if (playerIndex !== -1) {
                let moddedRemotePlayers = [...userRemotePlayers]
                moddedRemotePlayers.splice(playerIndex, 1)
                setUserRemotePlayers(moddedRemotePlayers)
            }
        }
        if (accessible) {
            const tagIndex = userRemotePlayers.indexOf(remotePlayerId)
            if (tagIndex === -1) {
                let moddedRemotePlayers = [...userRemotePlayers]
                moddedRemotePlayers.push(remotePlayerId)
                setUserRemotePlayers(moddedRemotePlayers)
            }
        }
    }

    let shelfPicker = null
    if (shelves && shelves.length) {
        const renderShelf = (shelf) => {
            if (userShelves && userShelves.indexOf(shelf.id) !== -1) {
                return (
                    <C.SnowTextButton
                        title={shelf.name + ' YES'}
                        onPress={() => {
                            setShelfAccess(shelf.id, false)
                        }}
                    ></C.SnowTextButton>
                )
            }
            return (
                <C.SnowTextButton
                    title={shelf.name + ' NO'}
                    onPress={() => {
                        setShelfAccess(shelf.id, true)
                    }}
                ></C.SnowTextButton>
            )
        }
        shelfPicker = (
            <C.SnowView>
                <C.SnowLabel center>Shelves</C.SnowLabel>
                <C.SnowGrid short={true} items={shelves} renderItem={renderShelf} />
            </C.SnowView>
        )
    }


    let tagPicker = null
    if (tags && tags.length) {
        const renderTag = (tag) => {
            if (userTags && userTags.indexOf(tag.id) !== -1) {
                return (
                    <C.SnowTextButton
                        title={tag.name + ' YES'}
                        onPress={() => {
                            setTagAccess(tag.id, false)
                        }}
                    ></C.SnowTextButton>
                )
            }
            return (
                <C.SnowTextButton
                    title={tag.name + ' NO'}
                    onPress={() => {
                        setTagAccess(tag.id, true)
                    }}
                ></C.SnowTextButton>
            )
        }
        tagPicker = (
            <C.SnowView>
                <C.SnowLabel center>Tags</C.SnowLabel>
                <C.SnowGrid short={true} items={tags} renderItem={renderTag} />
            </C.SnowView>
        )
    }

    let remotePlayerPicker = null
    if (remotePlayers && remotePlayers.length) {
        const renderPlayer = (player) => {
            if (userRemotePlayers && userRemotePlayers.indexOf(player.id) !== -1) {
                return (
                    <C.SnowTextButton
                        title={player.name + ' YES'}
                        onPress={() => {
                            setRemotePlayerAccess(player.id, false)
                        }}
                    ></C.SnowTextButton>
                )
            }
            return (
                <C.SnowTextButton
                    title={player.name + ' NO'}
                    onPress={() => {
                        setRemotePlayerAccess(player.id, true)
                    }}
                ></C.SnowTextButton>
            )
        }
        remotePlayerPicker = (
            <C.SnowView>
                <C.SnowLabel center>Remote Players</C.SnowLabel>
                <C.SnowGrid short={true} items={remotePlayers} renderItem={renderPlayer} />
            </C.SnowView>
        )
    }

    return (
        <C.SnowView>
            <C.SnowGrid itemsPerRow={2}>
                <C.SnowTextButton title="User Details" onPress={navPush({
                    path: routes.adminUserEdit,
                    params: { userId: userId }
                })} />
                <C.SnowTextButton title="User Access" onPress={navPush({
                    path: routes.adminUserAccess,
                    params: { userId: userId }
                })} />
            </C.SnowGrid>

            {shelfPicker}
            {tagPicker}
            {remotePlayerPicker}
            <C.SnowBreak />
            <C.SnowGrid>
                <C.SnowTextButton title="Save User Access" onPress={saveUserAccess} />
            </C.SnowGrid>
        </C.SnowView>
    )
}
