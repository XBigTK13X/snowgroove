import React, { useRef, useState, useCallback, useEffect } from 'react'
import { Animated, PanResponder, Text, View, FlatList, Pressable, StyleSheet } from 'react-native'
import Snow from 'expo-snowui'

const styles = StyleSheet.create({
    container: {
        flex: 1,
        minHeight: 0
    },
    listWrapper: {
        flex: 1,
        minHeight: 0,
        position: 'relative'
    },
    label: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#fff'
    },
    row: {
        width: '100%'
    },
    innerRow: {
        flex: 1,
        position: 'relative'
    },
    rowBackgroundClicker: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 0,
        justifyContent: 'center',
        paddingHorizontal: 15,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
        backgroundColor: 'transparent'
    },
    dragOverlay: {
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 1000,
        elevation: 12,
        shadowColor: '#000',
        shadowOpacity: 0.5,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 }
    },
    dropIndicator: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: 3,
        backgroundColor: '#00ffff',
        zIndex: 50
    }
})

const DraggableRow = React.memo((props) => {
    const {
        item,
        index,
        rowHeight,
        onLongPressRow,
        onPress,
        disableDrag,
        activeIndex,
        SnowStyle,
        renderItem,
        isBeingDragged
    } = props

    const handlePress = useCallback(() => {
        if (onPress) {
            onPress(item)
        }
    }, [onPress, item])

    const handleLongPress = useCallback(() => {
        if (disableDrag) return
        onLongPressRow(index)
    }, [disableDrag, index, onLongPressRow])

    const backgroundColor = index % 2 === 0
        ? (activeIndex === index ? SnowStyle.color.core : SnowStyle.color.core + '50')
        : (activeIndex === index ? SnowStyle.color.coreDark : SnowStyle.color.coreDark + '50')

    const componentKey = item.id ? `drag-item-${item.id}-${index}` : `drag-index-${index}`

    return (
        <View
            key={componentKey}
            style={[
                styles.row,
                { height: rowHeight, backgroundColor, opacity: isBeingDragged ? 0.2 : 1 }
            ]}
        >
            <View style={styles.innerRow}>
                <Pressable
                    style={styles.rowBackgroundClicker}
                    onPress={handlePress}
                    onLongPress={handleLongPress}
                    delayLongPress={250}
                >
                    <View pointerEvents={disableDrag ? 'auto' : 'box-none'} style={{ flex: 1, justifyContent: 'center' }}>
                        {renderItem(item, index)}
                    </View>
                </Pressable>
            </View>
        </View>
    )
}, (prevProps, nextProps) => {
    return (
        prevProps.index === nextProps.index &&
        prevProps.activeIndex === nextProps.activeIndex &&
        prevProps.item === nextProps.item &&
        prevProps.rowHeight === nextProps.rowHeight &&
        prevProps.disableDrag === nextProps.disableDrag &&
        prevProps.isBeingDragged === nextProps.isBeingDragged
    )
})

export function SnowDraggableColumn(props) {
    const { SnowStyle } = Snow.useSnowContext(props)
    const rowHeight = props.rowHeight ?? 120

    const [draggingIndex, setDraggingIndex] = useState(null)
    const [targetIndex, setTargetIndex] = useState(null)

    const dragY = useRef(new Animated.Value(0)).current
    const scrollOffset = useRef(0)

    const stateRef = useRef({ draggingIndex: null, targetIndex: null, items: null })
    stateRef.current.draggingIndex = draggingIndex
    stateRef.current.targetIndex = targetIndex
    stateRef.current.items = props.items || null

    useEffect(() => {
        return () => {
            stateRef.current = { draggingIndex: null, targetIndex: null, items: null }
            dragY.stopAnimation()
            dragY.removeAllListeners()
        }
    }, [dragY])

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onStartShouldSetPanResponderCapture: () => false,
            onMoveShouldSetPanResponder: () => stateRef.current?.draggingIndex !== null,
            onMoveShouldSetPanResponderCapture: () => stateRef.current?.draggingIndex !== null,
            onPanResponderGrant: () => { },
            onPanResponderMove: (event, gestureState) => {
                const currentDragging = stateRef.current?.draggingIndex
                if (currentDragging === null || currentDragging === undefined) return

                const initialTop = (currentDragging * rowHeight) - scrollOffset.current
                const currentTop = initialTop + gestureState.dy

                dragY.setValue(currentTop)

                const itemsCount = stateRef.current?.items?.length ?? 0
                if (itemsCount === 0) return

                const calculatedTarget = Math.round((currentTop + scrollOffset.current) / rowHeight)
                const boundedTarget = Math.max(0, Math.min(calculatedTarget, itemsCount - 1))

                if (boundedTarget !== stateRef.current.targetIndex) {
                    setTargetIndex(boundedTarget)
                }
            },
            onPanResponderRelease: (event, gestureState) => {
                const currentDragging = stateRef.current?.draggingIndex
                const currentTarget = stateRef.current?.targetIndex
                const currentItems = stateRef.current?.items

                setDraggingIndex(null)
                setTargetIndex(null)

                if (
                    currentDragging !== null &&
                    currentDragging !== undefined &&
                    currentTarget !== null &&
                    currentTarget !== undefined &&
                    currentDragging !== currentTarget &&
                    currentItems
                ) {
                    const listCopy = [...currentItems]
                    const [movedItem] = listCopy.splice(currentDragging, 1)
                    listCopy.splice(currentTarget, 0, movedItem)

                    if (props.onReorder) {
                        props.onReorder(listCopy)
                    }
                }
            },
            onPanResponderTerminate: () => {
                setDraggingIndex(null)
                setTargetIndex(null)
            }
        })
    ).current

    const handleLongPressRow = useCallback((index) => {
        const initialTop = (index * rowHeight) - scrollOffset.current
        dragY.setValue(initialTop)
        setDraggingIndex(index)
        setTargetIndex(index)
    }, [rowHeight, dragY])

    const handleScroll = useCallback((event) => {
        scrollOffset.current = event.nativeEvent.contentOffset.y
    }, [])

    const renderRowItem = useCallback(({ item, index }) => {
        return (
            <DraggableRow
                item={item}
                index={index}
                rowHeight={rowHeight}
                onLongPressRow={handleLongPressRow}
                onPress={props.onPress}
                disableDrag={props.disableDrag}
                activeIndex={props.activeIndex}
                SnowStyle={SnowStyle}
                renderItem={props.renderItem}
                isBeingDragged={draggingIndex === index}
            />
        )
    }, [
        rowHeight,
        handleLongPressRow,
        props.onPress,
        props.disableDrag,
        props.activeIndex,
        SnowStyle,
        props.renderItem,
        draggingIndex
    ])

    const keyExtractor = useCallback((item, index) => {
        return item.id ? `drag-item-${item.id}` : `drag-index-${index}`
    }, [])

    const draggedItem = draggingIndex !== null ? props.items?.[draggingIndex] : null

    return (
        <View style={styles.container}>
            {props.title ? (
                <Text style={styles.label}>
                    {props.title} ({props.items?.length ?? 0})
                </Text>
            ) : null}

            <View style={styles.listWrapper} {...panResponder.panHandlers}>
                <FlatList
                    style={{ flex: 1 }}
                    data={props.items}
                    renderItem={renderRowItem}
                    keyExtractor={keyExtractor}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                    scrollEnabled={draggingIndex === null}
                    nestedScrollEnabled={true}
                    removeClippedSubviews={false}
                />

                {draggingIndex !== null && targetIndex !== null ? (
                    <View
                        style={[
                            styles.dropIndicator,
                            { top: (targetIndex * rowHeight) - scrollOffset.current }
                        ]}
                        pointerEvents="none"
                    />
                ) : null}

                {draggingIndex !== null && draggedItem ? (
                    <Animated.View
                        style={[
                            styles.dragOverlay,
                            {
                                height: rowHeight,
                                top: dragY,
                                backgroundColor: SnowStyle.color.core
                            }
                        ]}
                        pointerEvents="none"
                    >
                        <View style={styles.rowBackgroundClicker}>
                            {props.renderItem(draggedItem, draggingIndex)}
                        </View>
                    </Animated.View>
                ) : null}
            </View>
        </View>
    )
}

export default SnowDraggableColumn