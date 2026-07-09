import Snow from 'expo-snowui'
import { useAudioContext } from '../audio-context'
import { useAppContext } from '../app-context'
import SnowDraggableColumn from './snow-draggable-column'

export function SnowSongList(props) {
    const { pushModal, popModal, navPush } = Snow.useSnowContext()
    const { routes } = useAppContext()
    const {
        addAudioFileToQueue,
        playAudioFile,
        musicSession,
        reorderMusicQueue,
        removeAudioFileFromQueue,
        removeCrateFromQueue
    } = useAudioContext()

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

    const removeCrate = (crateId) => {
        return () => {
            popModal()
            removeCrateFromQueue(crateId)
        }
    }


    const playNext = (audioFile) => {
        return () => {
            popModal()
            addAudioFileToQueue(audioFile, true)
        }
    }

    return (
        <SnowDraggableColumn
            {...props}
            title="Songs"
            activeIndex={props.activeQueue ? activeItemIndex : -1}
            disableDrag={props.disableDrag}
            items={props.audioFiles}
            rowHeight={100}
            onReorder={reorderMusicQueue}
            renderItem={(item, itemIndex) => {
                let itemDisplay = ''
                if (props.activeQueue) {
                    itemDisplay = `(${itemIndex + 1}/${props.audioFiles.length}) ${item.title} | ${item.album} | ${item.artist}`
                } else {
                    itemDisplay = `(${item.disc ?? 1}/${item.track}) ${item.title} | ${item.album} | ${item.artist}`
                }


                return (
                    <>
                        <Snow.Grid leftAlignRows>
                            <Snow.ImageButton
                                imageStyle={{ width: 50, height: 50 }}
                                wrapperStyle={{ width: 60, height: 70 }}
                                imageUrl={item.thumbnail_web_path}
                                onPress={() => {
                                    pushModal({
                                        render: (props) => {
                                            return (
                                                <Snow.Grid itemsPerRow={2}>
                                                    <Snow.TextButton title="Cancel" onPress={popModal} />
                                                    <Snow.TextButton title="Play Next" onPress={playNext(item)} />
                                                    <Snow.TextButton title="Add Song to Queue" onPress={() => { popModal(); addAudioFileToQueue(item) }} />
                                                    <Snow.TextButton title="Goto Album" onPress={gotoCrate(item.album_crate_id)} />
                                                    <Snow.TextButton title="Goto Artist" onPress={gotoCrate(item.artist_crate_id)} />
                                                    <Snow.TextButton title="Remove Song from Queue" onPress={removeSong(item)} />
                                                    <Snow.TextButton title="Remove Album from Queue" onPress={removeCrate(item.album_crate_id)} />
                                                    <Snow.TextButton title="Remove Artist from Queue" onPress={removeCrate(item.artist_crate_id)} />
                                                </Snow.Grid>
                                            )
                                        },
                                        props: {
                                            focusStart: true,
                                            center: true,
                                            obscure: true,
                                            onRequestClose: popModal
                                        }
                                    })
                                }}
                            />
                            <Snow.Text>{itemDisplay}</Snow.Text>

                        </Snow.Grid>
                    </>
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