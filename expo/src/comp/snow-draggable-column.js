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
    const { SnowStyle } = Snow.useSnowContext(props)
    const rowHeight = props.rowHeight ?? 120
    const longPressDelay = 500
    const tapMoveThreshold = 5

    const [itemsOrder, setItemsOrder] = React.useState(props.items || [])
    const [draggingIndex, setDraggingIndex] = React.useState(null)
    const [targetIndex, setTargetIndex] = React.useState(null)

    const dragY = React.useRef(new Animated.Value(0)).current
    const isDragging = React.useRef(false)
    const longPressTimeout = React.useRef(null)

    const stateRef = React.useRef({ draggingIndex: null, targetIndex: null, itemsOrder: [] })

    const panResponderMap = React.useRef(new Map())

    React.useEffect(() => {
        setItemsOrder(props.items || [])
    }, [props.items])

    React.useEffect(() => {
        stateRef.current.draggingIndex = draggingIndex
        stateRef.current.targetIndex = targetIndex
        stateRef.current.itemsOrder = itemsOrder

        const validItems = new Set(itemsOrder)
        for (const key of panResponderMap.current.keys()) {
            if (!validItems.has(key)) {
                panResponderMap.current.delete(key)
            }
        }
    }, [draggingIndex, targetIndex, itemsOrder])

    const getTargetIndex = (currentIndex, translateY) => {
        const calculatedIndex = currentIndex + Math.round(translateY / rowHeight)
        return Math.max(0, Math.min(calculatedIndex, stateRef.current.itemsOrder.length - 1))
    }

    const createRowPanResponder = (item) => {
        return PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (event, gestureState) => {
                if (props.disableDrag) return false
                return isDragging.current || Math.abs(gestureState.dy) > tapMoveThreshold
            },
            onPanResponderGrant: () => {
                dragY.setValue(0)

                if (props.disableDrag) return

                clearTimeout(longPressTimeout.current)
                longPressTimeout.current = setTimeout(() => {
                    const ii = stateRef.current.itemsOrder.indexOf(item)
                    if (ii === -1) return
                    isDragging.current = true
                    dragY.setValue(0)
                    setDraggingIndex(ii)
                    setTargetIndex(ii)
                }, longPressDelay)
            },
            onPanResponderMove: (event, gestureState) => {
                if (!isDragging.current) {
                    if (Math.abs(gestureState.dy) > tapMoveThreshold || Math.abs(gestureState.dx) > tapMoveThreshold) {
                        clearTimeout(longPressTimeout.current)
                    }
                    return
                }

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

                const wasDragging = isDragging.current
                const currentDraggingIndex = stateRef.current.draggingIndex
                const currentTargetIndex = stateRef.current.targetIndex

                isDragging.current = false
                setDraggingIndex(null)
                setTargetIndex(null)
                dragY.setValue(0)

                if (wasDragging) {
                    if (currentDraggingIndex !== null && currentTargetIndex !== null && currentTargetIndex !== currentDraggingIndex) {
                        const updatedList = [...stateRef.current.itemsOrder]
                        const [movedItem] = updatedList.splice(currentDraggingIndex, 1)
                        updatedList.splice(currentTargetIndex, 0, movedItem)

                        setItemsOrder(updatedList)
                        if (props.onReorder) {
                            props.onReorder(updatedList)
                        }
                    }
                } else if (Math.abs(gestureState.dx) < tapMoveThreshold && Math.abs(gestureState.dy) < tapMoveThreshold) {
                    if (props.onPress) {
                        props.onPress(item)
                    }
                }
            },
            onPanResponderTerminationRequest: () => !isDragging.current,
            onPanResponderTerminate: () => {
                clearTimeout(longPressTimeout.current)
                isDragging.current = false
                setDraggingIndex(null)
                setTargetIndex(null)
                dragY.setValue(0)
            }
        })
    }

    const getRowPanHandlers = (item) => {
        if (!panResponderMap.current.has(item)) {
            panResponderMap.current.set(item, createRowPanResponder(item))
        }
        return panResponderMap.current.get(item).panHandlers
    }

    return (
        <Snow.View {...props} style={styles.container}>
            {props.title ? (
                <Text style={styles.label}>
                    {props.title} ({itemsOrder.length})
                </Text>
            ) : null}
            <Snow.View style={{ height: itemsOrder.length * rowHeight, width: '100%', position: 'relative' }}>
                {itemsOrder.map((item, ii) => {
                    const isCurrentDragging = draggingIndex === ii
                    const calculatedTop = ii * rowHeight

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
                            <Snow.View yy={ii} style={[styles.innerRow, isCurrentDragging && styles.innerRowDragging]}>
                                <View style={styles.rowBackgroundClicker} {...getRowPanHandlers(item)}>
                                    <Snow.View pointerEvents="box-none" style={{ flex: 1, justifyContent: 'center' }}>
                                        {props.renderItem(item, ii)}
                                    </Snow.View>
                                </View>
                            </Snow.View>
                        </Animated.View>
                    )
                })}

                {draggingIndex !== null && targetIndex !== null && draggingIndex !== targetIndex ? (
                    <Snow.View
                        style={[
                            styles.dropIndicator,
                            { top: targetIndex * rowHeight + (draggingIndex < targetIndex ? rowHeight : 0) }
                        ]}
                    />
                ) : null}
            </Snow.View>
        </Snow.View>
    )
}

export default SnowDraggableColumn