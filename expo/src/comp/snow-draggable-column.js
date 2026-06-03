import React from 'react'
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native'

export function SnowDraggableColumn(props) {
    const rowHeight = 60
    const longPressDelay = 500

    const [itemsOrder, setItemsOrder] = React.useState(props.items)
    const [draggingIdx, setDraggingIdx] = React.useState(null)
    const [targetIdx, setTargetIdx] = React.useState(null)

    const dragY = React.useRef(new Animated.Value(0)).current
    const panY = React.useRef(0)
    const isDragging = React.useRef(false)
    const longPressTimeout = React.useRef(null)

    const stateRef = React.useRef({ draggingIdx: null, targetIdx: null, itemsOrder: [] })

    React.useEffect(() => {
        setItemsOrder(props.items)
    }, [props.items])

    React.useEffect(() => {
        stateRef.current.draggingIdx = draggingIdx
        stateRef.current.targetIdx = targetIdx
        stateRef.current.itemsOrder = itemsOrder
    }, [draggingIdx, targetIdx, itemsOrder])

    const getTargetIndex = (currentIndex, translateY) => {
        const calculatedIndex = currentIndex + Math.round(translateY / rowHeight)
        return Math.max(0, Math.min(calculatedIndex, stateRef.current.itemsOrder.length - 1))
    }

    const panResponder = React.useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => !props.disableDrag,
            onMoveShouldSetPanResponder: (event, gestureState) => {
                if (props.disableDrag) return false
                return isDragging.current || Math.abs(gestureState.dy) > 2
            },
            onPanResponderGrant: (event, gestureState) => {
                if (props.disableDrag) return

                const locationY = event.nativeEvent.locationY
                let calculatedIndex = Math.floor(locationY / rowHeight)
                if (calculatedIndex < 0 || calculatedIndex >= stateRef.current.itemsOrder.length) {
                    return
                }

                panY.current = 0
                dragY.setValue(0)

                longPressTimeout.current = setTimeout(() => {
                    isDragging.current = true
                    setDraggingIdx(calculatedIndex)
                    setTargetIdx(calculatedIndex)
                }, longPressDelay)
            },
            onPanResponderMove: (event, gestureState) => {
                if (!isDragging.current) {
                    if (Math.abs(gestureState.dy) > 10) {
                        clearTimeout(longPressTimeout.current)
                    }
                    return
                }

                panY.current = gestureState.dy
                dragY.setValue(gestureState.dy)

                const currentDraggingIdx = stateRef.current.draggingIdx
                if (currentDraggingIdx !== null) {
                    const currentTarget = getTargetIndex(currentDraggingIdx, gestureState.dy)
                    if (currentTarget !== stateRef.current.targetIdx) {
                        setTargetIdx(currentTarget)
                    }
                }
            },
            onPanResponderRelease: (event, gestureState) => {
                clearTimeout(longPressTimeout.current)

                const currentDraggingIdx = stateRef.current.draggingIdx
                const currentTargetIdx = stateRef.current.targetIdx

                if (!isDragging.current) {
                    const locationY = event.nativeEvent.locationY
                    const clickIdx = Math.floor(locationY / rowHeight)
                    const clickedItem = stateRef.current.itemsOrder[clickIdx]

                    if (clickedItem && props.onPress && Math.abs(gestureState.dx) < 5 && Math.abs(gestureState.dy) < 5) {
                        props.onPress(clickedItem)
                    }

                    isDragging.current = false
                    setDraggingIdx(null)
                    setTargetIdx(null)
                    return
                }

                isDragging.current = false
                setDraggingIdx(null)
                setTargetIdx(null)

                if (currentDraggingIdx !== null && currentTargetIdx !== null) {
                    if (currentTargetIdx !== currentDraggingIdx) {
                        const updatedList = [...stateRef.current.itemsOrder]
                        const [movedItem] = updatedList.splice(currentDraggingIdx, 1)
                        updatedList.splice(currentTargetIdx, 0, movedItem)

                        setItemsOrder(updatedList)
                        if (props.onReorder) {
                            props.onReorder(updatedList)
                        }
                    }
                }
                dragY.setValue(0)
            },
            onPanResponderTerminate: () => {
                clearTimeout(longPressTimeout.current)
                isDragging.current = false
                setDraggingIdx(null)
                setTargetIdx(null)
                dragY.setValue(0)
            }
        })
    ).current

    return (
        <View style={styles.container}>
            {props.title ? (
                <Text style={styles.label}>
                    {props.title} ({itemsOrder.length})
                </Text>
            ) : null}
            <View
                style={{ height: itemsOrder.length * rowHeight, width: '100%', position: 'relative' }}
                {...panResponder.panHandlers}
            >
                {itemsOrder.map((item, ii) => {
                    const isCurrentDragging = draggingIdx === ii
                    let calculatedTop = ii * rowHeight

                    if (draggingIdx !== null && !isCurrentDragging) {
                        if (ii > draggingIdx && ii <= targetIdx) {
                            calculatedTop -= rowHeight
                        } else if (ii < draggingIdx && ii >= targetIdx) {
                            calculatedTop += rowHeight
                        }
                    }

                    const rowStyle = isCurrentDragging
                        ? [
                            styles.row,
                            styles.draggingRow,
                            {
                                top: ii * rowHeight,
                                transform: [{ translateY: dragY }],
                                height: rowHeight
                            }
                        ]
                        : [
                            styles.row,
                            {
                                top: calculatedTop,
                                height: rowHeight
                            }
                        ]

                    return (
                        <Animated.View
                            key={item.id}
                            style={rowStyle}
                            accessibilityRole="button"
                            data-focus-key={`${props.focusKey}-item-${ii}`}
                            data-parent-path={props.parentPath}
                            data-xx={props.xx}
                            data-yy={ii}
                        >
                            <View pointerEvents="none" style={[styles.innerRow, isCurrentDragging && styles.innerRowDragging]}>
                                {props.renderItem(item)}
                            </View>
                        </Animated.View>
                    )
                })}

                {draggingIdx !== null && targetIdx !== null && draggingIdx !== targetIdx ? (
                    <View
                        pointerEvents="none"
                        style={[
                            styles.dropIndicator,
                            { top: targetIdx * rowHeight + (draggingIdx < targetIdx ? rowHeight : 0) }
                        ]}
                    />
                ) : null}
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1
    },
    label: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#fff'
    },
    row: {
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 1
    },
    draggingRow: {
        zIndex: 100,
        shadowColor: '#000',
        shadowOpacity: 0.4,
        shadowRadius: 6,
        elevation: 6
    },
    innerRow: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 15,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
        backgroundColor: 'transparent'
    },
    innerRowDragging: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 4,
        borderBottomWidth: 0
    },
    dropIndicator: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: 3,
        backgroundColor: '#00ffff',
        zIndex: 50,
        marginTop: -1.5
    }
})

export default SnowDraggableColumn