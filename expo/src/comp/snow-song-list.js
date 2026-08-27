import React from 'react'
import { View } from 'react-native'
import Snow from 'expo-snowui'
import { useAudioContext } from '../audio/audio-context'
import { useAppContext } from '../app-context'
import SnowDraggableColumn from './snow-draggable-column'

export function SnowSongList(props) {
    const { pushModal, popModal, navPush, SnowStyle } = Snow.useSnowContext(props)
    const { routes, apiClient } = useAppContext()
    const {
        addAudioFileToQueue,
        playAudioFile,
        musicSession,
        reorderMusicQueue,
        removeAudioFileFromQueue,
        removeCrateFromQueue
    } = useAudioContext()

    const [playlistList, setPlaylistList] = React.useState([])
    const playlistListRef = React.useRef([])

    React.useEffect(() => {
        apiClient.getPlaylistList(true).then((response) => {
            setPlaylistList(response)
            playlistListRef.current = response
        })
    }, [])

    let activeItemIndex = -1
    if (musicSession?.music_queue?.current_song_index > -1) {
        activeItemIndex = musicSession?.music_queue?.current_song_index
    }

    const gotoCrate = (crateId) => {
        return () => {
            popModal()
            navPush({
                path: routes.crateDetails,
                params: {
                    crateId: crateId
                },
                func: false
            })
        }
    }

    const removeSong = (audioFile) => {
        return () => {
            popModal()
            removeAudioFileFromQueue(audioFile)
        }
    }

    const removeCrate = (crateId, kind) => {
        return () => {
            popModal()
            removeCrateFromQueue(crateId, kind)
        }
    }

    const playNext = (audioFile) => {
        return () => {
            popModal()
            addAudioFileToQueue(audioFile, true)
        }
    }

    const showUpdatePlaylistModal = (audioFile) => {
        popModal()
        setTimeout(() => {
            pushModal({
                render: (modalProps) => {
                    const currentPlaylists = playlistListRef.current
                    return (
                        <Snow.View>
                            <Snow.Label center>Add {audioFile.title} to...</Snow.Label>
                            <Snow.Grid
                                parentPath={modalProps.parentPath}
                                focusKey="add-to-playlist"
                                items={currentPlaylists}
                                renderItem={(playlist) => {
                                    return (
                                        <Snow.TextButton
                                            title={playlist.name}
                                            onPress={() => {
                                                apiClient.addAudioFileToPlaylist(playlist.id, audioFile.fingerprint)
                                                popModal()
                                            }}
                                        />
                                    )
                                }}
                            />
                        </Snow.View>
                    )
                },
                props: {
                    center: true,
                    transparent: false,
                    onRequestClose: popModal
                }
            })
        }, 0)
    }

    const showSongActionModal = (audioFile) => {
        const currentPlaylists = playlistListRef.current
        pushModal({
            render: (modalProps) => {
                return (
                    <Snow.View>
                        <Snow.Label center>
                            {audioFile.title}
                        </Snow.Label>
                        <Snow.Grid
                            focusStart
                            parentPath={modalProps.parentPath}
                            focusKey="song-grid"
                            itemsPerRow={2}
                        >
                            <Snow.TextButton title="Cancel" onPress={popModal} />
                            <Snow.TextButton title="Play Now" onPress={() => { popModal(); playAudioFile(audioFile) }} />
                            <Snow.TextButton title="Play Next" onPress={playNext(audioFile)} />
                            <Snow.TextButton title="Add Song to Queue" onPress={() => { popModal(); addAudioFileToQueue(audioFile) }} />
                            {currentPlaylists && (
                                <Snow.TextButton title="Add Song to Playlist" onPress={() => { showUpdatePlaylistModal(audioFile) }} />
                            )}
                            <Snow.TextButton title="Goto Album" onPress={gotoCrate(audioFile.album_crate_id)} />
                            <Snow.TextButton title="Goto Artist" onPress={gotoCrate(audioFile.artist_crate_id)} />
                            <Snow.TextButton title="Remove Song from Queue" onPress={removeSong(audioFile)} />
                            <Snow.TextButton title="Remove Album from Queue" onPress={removeCrate(audioFile.album_crate_id, 'album')} />
                            <Snow.TextButton title="Remove Artist from Queue" onPress={removeCrate(audioFile.artist_crate_id, 'artist')} />
                        </Snow.Grid>
                    </Snow.View>
                )
            },
            props: {
                center: true,
                transparent: false,
                onRequestClose: popModal
            }
        })
    }

    return (
        <SnowDraggableColumn
            {...props}
            playlistRefresh={playlistList}
            title="Songs"
            activeIndex={props.activeQueue ? activeItemIndex : -1}
            disableDrag={props.disableDrag}
            items={props.audioFiles}
            rowHeight={100}
            onReorder={reorderMusicQueue}
            renderItem={(item, itemIndex) => {
                let itemDisplay = ''
                if (SnowStyle.isPortrait) {
                    if (props.activeQueue) {
                        itemDisplay = `(${itemIndex + 1}/${props.audioFiles.length})\n${item.title}\n${item.album}\n${item.artist}`
                    } else {
                        itemDisplay = `(${item.disc ?? 1}/${item.track})\n${item.title}\n${item.album}\n${item.artist}`
                    }
                }
                else {
                    if (props.activeQueue) {
                        itemDisplay = `(${itemIndex + 1}/${props.audioFiles.length}) ${item.title} | ${item.album} | ${item.artist}`
                    } else {
                        itemDisplay = `(${item.disc ?? 1}/${item.track}) ${item.title} | ${item.album} | ${item.artist}`
                    }
                }

                return (
                    <Snow.Grid yy={itemIndex} leftAlignRows style={{ width: '100%' }}>
                        <View
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'flex-start',
                                width: '100%'
                            }}
                        >
                            <Snow.ImageButton
                                imageStyle={{ width: 50, height: 50 }}
                                wrapperStyle={{ width: 60, height: 70, justifyContent: 'center' }}
                                imageUrl={item.thumbnail_web_path}
                                onPress={() => { showSongActionModal(item) }}
                            />
                            <View style={{ flex: 1, paddingLeft: 10, justifyContent: 'center' }}>
                                <Snow.Text noSelect>{itemDisplay}</Snow.Text>
                            </View>
                        </View>
                    </Snow.Grid>
                )
            }}
            onPress={(item) => {
                if (props.activeQueue) {
                    playAudioFile(item)
                }
                else {
                    addAudioFileToQueue(item)
                }
            }}
        />
    )
}

export default SnowSongList