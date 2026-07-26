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

const DraggableRow = React.memo((props) => {
    const {
        item,
        index,
        rowHeight,
        isDragging,
        dragY,
        onDragStart,
        onDragMove,
        onDragEnd,
        onPress,
        disableDrag,
        activeIndex,
        SnowStyle,
        focusKey,
        parentPath,
        xx,
        renderItem
    } = props

    const longPressTimeout = React.useRef(null)
    const touchStartPos = React.useRef({ x: 0, y: 0 })
    const isDraggingRef = React.useRef(false)

    isDraggingRef.current = isDragging

    const panResponder = React.useMemo(() => {
        return PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (event) => {
                touchStartPos.current = {
                    x: event.nativeEvent.pageX,
                    y: event.nativeEvent.pageY
                }

                if (disableDrag) return

                clearTimeout(longPressTimeout.current)
                longPressTimeout.current = setTimeout(() => {
                    onDragStart(index)
                }, 500)
            },
            onPanResponderMove: (event, gestureState) => {
                if (!isDraggingRef.current) {
                    const deltaX = Math.abs(event.nativeEvent.pageX - touchStartPos.current.x)
                    const deltaY = Math.abs(event.nativeEvent.pageY - touchStartPos.current.y)

                    if (deltaX > 8 || deltaY > 8) {
                        clearTimeout(longPressTimeout.current)
                    }
                    return
                }

                onDragMove(gestureState.dy)
            },
            onPanResponderRelease: (event, gestureState) => {
                clearTimeout(longPressTimeout.current)

                if (isDraggingRef.current) {
                    onDragEnd(gestureState.dy)
                } else {
                    const deltaX = Math.abs(event.nativeEvent.pageX - touchStartPos.current.x)
                    const deltaY = Math.abs(event.nativeEvent.pageY - touchStartPos.current.y)

                    if (deltaX < 8 && deltaY < 8 && onPress) {
                        onPress(item)
                    }
                }
            },
            onPanResponderTerminationRequest: () => {
                return !isDraggingRef.current
            },
            onPanResponderTerminate: () => {
                clearTimeout(longPressTimeout.current)
                if (isDraggingRef.current) {
                    onDragEnd(0)
                }
            }
        })
    }, [index, disableDrag, onDragStart, onDragMove, onDragEnd, onPress, item])

    const calculatedTop = index * rowHeight
    const rowStyle = [
        styles.row,
        {
            top: calculatedTop,
            height: rowHeight
        },
        isDragging && styles.draggingRow,
        isDragging && { transform: [{ translateY: dragY }] }
    ]

    if (index % 2 === 0) {
        rowStyle.push({
            backgroundColor: activeIndex === index ? SnowStyle.color.core : SnowStyle.color.core + '50'
        })
    } else {
        rowStyle.push({
            backgroundColor: activeIndex === index ? SnowStyle.color.coreDark : SnowStyle.color.coreDark + '50'
        })
    }

    const componentKey = item.id ? `drag-item-${item.id}-${index}` : `drag-index-${index}`

    return (
        <Animated.View
            key={componentKey}
            style={rowStyle}
            accessibilityRole="button"
            data-focus-key={`${focusKey}-item-${index}`}
            data-parent-path={parentPath}
            data-xx={xx}
            data-yy={index}
        >
            <Snow.View yy={index} style={[styles.innerRow, isDragging && styles.innerRowDragging]}>
                <View style={styles.rowBackgroundClicker} {...panResponder.panHandlers}>
                    <Snow.View pointerEvents="box-none" style={{ flex: 1, justifyContent: 'center' }}>
                        {renderItem(item, index)}
                    </Snow.View>
                </View>
            </Snow.View>
        </Animated.View>
    )
}, (prevProps, nextProps) => {
    return (
        prevProps.index === nextProps.index &&
        prevProps.isDragging === nextProps.isDragging &&
        prevProps.activeIndex === nextProps.activeIndex &&
        prevProps.item === nextProps.item &&
        prevProps.rowHeight === nextProps.rowHeight &&
        prevProps.disableDrag === nextProps.disableDrag
    )
})

export function SnowDraggableColumn(props) {
    const { SnowStyle } = Snow.useSnowContext(props)
    const rowHeight = props.rowHeight ?? 120

    const [itemsOrder, setItemsOrder] = React.useState(props.items || [])
    const [draggingIndex, setDraggingIndex] = React.useState(null)
    const [targetIndex, setTargetIndex] = React.useState(null)

    const dragY = React.useRef(new Animated.Value(0)).current
    const stateRef = React.useRef({ draggingIndex: null, targetIndex: null, itemsOrder: [] })

    React.useEffect(() => {
        setItemsOrder(props.items || [])
    }, [props.items])

    React.useEffect(() => {
        stateRef.current.draggingIndex = draggingIndex
        stateRef.current.targetIndex = targetIndex
        stateRef.current.itemsOrder = itemsOrder
    }, [draggingIndex, targetIndex, itemsOrder])

    const handleDragStart = React.useCallback((index) => {
        dragY.setValue(0)
        setDraggingIndex(index)
        setTargetIndex(index)
    }, [dragY])

    const handleDragMove = React.useCallback((deltaY) => {
        dragY.setValue(deltaY)
        const currentDragging = stateRef.current.draggingIndex
        if (currentDragging !== null) {
            const calculated = currentDragging + Math.round(deltaY / rowHeight)
            const nextTarget = Math.max(0, Math.min(calculated, stateRef.current.itemsOrder.length - 1))
            if (nextTarget !== stateRef.current.targetIndex) {
                setTargetIndex(nextTarget)
            }
        }
    }, [dragY, rowHeight])

    const handleDragEnd = React.useCallback((deltaY) => {
        const currentDragging = stateRef.current.draggingIndex
        const currentTarget = stateRef.current.targetIndex

        setDraggingIndex(null)
        setTargetIndex(null)
        dragY.setValue(0)

        if (currentDragging !== null && currentTarget !== null && currentTarget !== currentDragging) {
            const updatedList = [...stateRef.current.itemsOrder]
            const [movedItem] = updatedList.splice(currentDragging, 1)
            updatedList.splice(currentTarget, 0, movedItem)

            setItemsOrder(updatedList)
            if (props.onReorder) {
                props.onReorder(updatedList)
            }
        }
    }, [dragY, props])

    return (
        <Snow.View {...props} style={styles.container}>
            {props.title ? (
                <Text style={styles.label}>
                    {props.title} ({itemsOrder.length})
                </Text>
            ) : null}
            <Snow.View style={{ height: itemsOrder.length * rowHeight, width: '100%', position: 'relative' }}>
                {itemsOrder.map((item, index) => (
                    <DraggableRow
                        key={item.id ? `drag-item-${item.id}` : `drag-index-${index}`}
                        item={item}
                        index={index}
                        rowHeight={rowHeight}
                        isDragging={draggingIndex === index}
                        dragY={dragY}
                        onDragStart={handleDragStart}
                        onDragMove={handleDragMove}
                        onDragEnd={handleDragEnd}
                        onPress={props.onPress}
                        disableDrag={props.disableDrag}
                        activeIndex={props.activeIndex}
                        SnowStyle={SnowStyle}
                        focusKey={props.focusKey}
                        parentPath={props.parentPath}
                        xx={props.xx}
                        renderItem={props.renderItem}
                    />
                ))}

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