import React from 'react'
import { Animated, PanResponder, Text, View } from 'react-native'
import Snow from 'expo-snowui'

const styles = {
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
}

export function SnowDraggableColumn(props) {
    const { SnowStyle } = Snow.useStyleContext(props)
    const rowHeight = props.rowHeight ?? 120
    const longPressDelay = 500

    const [itemsOrder, setItemsOrder] = React.useState(props.items || [])
    const [draggingIndex, setDraggingIndex] = React.useState(null)
    const [targetIndex, setTargetIndex] = React.useState(null)

    const dragY = React.useRef(new Animated.Value(0)).current
    const panY = React.useRef(0)
    const isDragging = React.useRef(false)
    const longPressTimeout = React.useRef(null)

    const stateRef = React.useRef({ draggingIndex: null, targetIndex: null, itemsOrder: [] })

    React.useEffect(() => {
        setItemsOrder(props.items || [])
    }, [props.items])

    React.useEffect(() => {
        stateRef.current.draggingIndex = draggingIndex
        stateRef.current.targetIndex = targetIndex
        stateRef.current.itemsOrder = itemsOrder
    }, [draggingIndex, targetIndex, itemsOrder])

    const getTargetIndex = (currentIndex, translateY) => {
        const calculatedIndex = currentIndex + Math.round(translateY / rowHeight)
        return Math.max(0, Math.min(calculatedIndex, stateRef.current.itemsOrder.length - 1))
    }

    const panResponder = React.useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (event, gestureState) => {
                if (props.disableDrag) return false
                return isDragging.current || Math.abs(gestureState.dy) > 2
            },
            onPanResponderGrant: (event, gestureState) => {
                const locationY = event.nativeEvent.locationY
                let calculatedIndex = Math.floor(locationY / rowHeight)
                if (calculatedIndex < 0 || calculatedIndex >= stateRef.current.itemsOrder.length) {
                    return
                }

                panY.current = 0
                dragY.setValue(0)

                if (props.disableDrag) return

                longPressTimeout.current = setTimeout(() => {
                    isDragging.current = true
                    setDraggingIndex(calculatedIndex)
                    setTargetIndex(calculatedIndex)
                }, longPressDelay)
            },
            onPanResponderMove: (event, gestureState) => {
                if (props.disableDrag) return

                if (!isDragging.current) {
                    if (Math.abs(gestureState.dy) > 10) {
                        clearTimeout(longPressTimeout.current)
                    }
                    return
                }

                panY.current = gestureState.dy
                dragY.setValue(gestureState.dy)

                const currentDraggingIndex = stateRef.current.draggingIndex
                if (currentDraggingIndex !== null) {
                    const currentTarget = getTargetIndex(currentDraggingIndex, gestureState.dy)
                    if (currentTarget !== stateRef.current.targetIndex) {
                        setTargetIndex(currentTarget)
                    }
                }
            },
            onPanResponderRelease: (event, gestureState) => {
                clearTimeout(longPressTimeout.current)

                const currentDraggingIndex = stateRef.current.draggingIndex
                const currentTargetIndex = stateRef.current.targetIndex

                if (!isDragging.current) {
                    const locationY = event.nativeEvent.locationY
                    const clickIndex = Math.floor(locationY / rowHeight)
                    const clickedItem = stateRef.current.itemsOrder[clickIndex]

                    if (clickedItem && props.onPress && Math.abs(gestureState.dx) < 5 && Math.abs(gestureState.dy) < 5) {
                        props.onPress(clickedItem)
                    }

                    isDragging.current = false
                    setDraggingIndex(null)
                    setTargetIndex(null)
                    return
                }

                isDragging.current = false
                setDraggingIndex(null)
                setTargetIndex(null)

                if (currentDraggingIndex !== null && currentTargetIndex !== null) {
                    if (currentTargetIndex !== currentDraggingIndex) {
                        const updatedList = [...stateRef.current.itemsOrder]
                        const [movedItem] = updatedList.splice(currentDraggingIndex, 1)
                        updatedList.splice(currentTargetIndex, 0, movedItem)

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
                setDraggingIndex(null)
                setTargetIndex(null)
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
                    const isCurrentDragging = draggingIndex === ii
                    let calculatedTop = ii * rowHeight

                    if (draggingIndex !== null && !isCurrentDragging) {
                        if (ii > draggingIndex && ii <= targetIndex) {
                            calculatedTop -= rowHeight
                        } else if (ii < draggingIndex && ii >= targetIndex) {
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

                    if (ii % 2 == 0) {
                        if (props.activeIndex === ii) {
                            rowStyle.push({ backgroundColor: SnowStyle.color.core })
                        } else {
                            rowStyle.push({ backgroundColor: SnowStyle.color.core + '50' })
                        }
                    } else {
                        if (props.activeIndex === ii) {
                            rowStyle.push({ backgroundColor: SnowStyle.color.coreDark })
                        } else {
                            rowStyle.push({ backgroundColor: SnowStyle.color.coreDark + '50' })
                        }
                    }

                    const componentKey = item.id ? `drag-item-${item.id}-${ii}` : `drag-index-${ii}`

                    return (
                        <Animated.View
                            key={componentKey}
                            style={rowStyle}
                            accessibilityRole="button"
                            data-focus-key={`${props.focusKey}-item-${ii}`}
                            data-parent-path={props.parentPath}
                            data-xx={props.xx}
                            data-yy={ii}
                        >
                            <View style={[styles.innerRow, isCurrentDragging && styles.innerRowDragging]}>
                                {props.renderItem(item, ii)}
                            </View>
                        </Animated.View>
                    )
                })}

                {draggingIndex !== null && targetIndex !== null && draggingIndex !== targetIndex ? (
                    <View
                        style={[
                            styles.dropIndicator,
                            { top: targetIndex * rowHeight + (draggingIndex < targetIndex ? rowHeight : 0) }
                        ]}
                    />
                ) : null}
            </View>
        </View>
    )
}

export default SnowDraggableColumn