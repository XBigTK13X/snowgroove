import Snow from 'expo-snowui'
import { useAudioContext } from 'snowgroove'
import SnowDraggableColumn from './snow-draggable-column'

export function SnowSongList(props) {
    const { addAudioFileToQueue } = useAudioContext()
    return (
        <SnowDraggableColumn
            {...props}
            title="Songs"
            disableDrag={props.disableDrag}
            items={props.audioFiles}
            rowHeight={100}
            renderItem={(item) => {
                return (
                    <Snow.Grid leftAlignRows>
                        <Snow.Image
                            style={{ width: 50, height: 50 }}
                            source={{ uri: item.thumbnail_web_path }}
                        />
                        <Snow.Text>{item.position} - {item.title}</Snow.Text>
                    </Snow.Grid>
                )
            }}
            onPress={(item) => {
                addAudioFileToQueue(item)
            }}
        />
    )
}

export default SnowSongList