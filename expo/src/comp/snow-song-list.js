import Snow from 'expo-snowui'
import { useAudioContext } from '../audio-context'
import SnowDraggableColumn from './snow-draggable-column'

export function SnowSongList(props) {
    const { pushModal, popModal } = Snow.useSnowContext()
    const { addAudioFileToQueue, playAudioFile, musicSession } = useAudioContext()

    let activeItemIndex = -1
    if (musicSession?.music_queue?.current_song_index > -1) {
        activeItemIndex = musicSession?.music_queue?.current_song_index
    }

    return (
        <SnowDraggableColumn
            {...props}
            title="Songs"
            activeIndex={props.activeQueue ? activeItemIndex : -1}
            disableDrag={props.disableDrag}
            items={props.audioFiles}
            rowHeight={100}
            renderItem={(item) => {
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
                                                <Snow.Grid itemsPerRow={1}>
                                                    <Snow.TextButton title="Play Next" onPress={popModal} />
                                                    <Snow.TextButton title="Add Song to Queue" onPress={popModal} />
                                                    <Snow.TextButton title="Goto Album" onPress={popModal} />
                                                    <Snow.TextButton title="Goto Artist" onPress={popModal} />
                                                    <Snow.TextButton title="Remove Song from Queue" onPress={popModal} />
                                                    <Snow.TextButton title="Remove Album from Queue" onPress={popModal} />
                                                    <Snow.TextButton title="Remove Artist from Queue" onPress={popModal} />
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
                            <Snow.Text>D{item.disc ?? 1} T{item.track} - {item.title}</Snow.Text>

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