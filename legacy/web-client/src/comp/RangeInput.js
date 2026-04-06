import React, { Component } from 'react'
import { Range, getTrackBackground } from 'react-range'

export default class RangeInput extends Component {
    render() {
        return (
            <Range
                step={0.1}
                min={0}
                max={100}
                values={[this.props.value]}
                onChange={(e) => {
                    this.props.onChange(e[0])
                }}
                renderTrack={({ props, children }) => (
                    <div
                        onMouseDown={props.onMouseDown}
                        onTouchStart={props.onTouchStart}
                        style={{
                            ...props.style,
                            height: '36px',
                            display: 'flex',
                            width: '100%',
                        }}
                    >
                        <div
                            ref={props.ref}
                            style={{
                                height: '5px',
                                width: '100%',
                                borderRadius: '4px',
                                background: getTrackBackground({
                                    values: [this.props.value],
                                    colors: ['#AC03F4', '#ccc'],
                                    min: 0,
                                    max: 100,
                                }),
                                alignSelf: 'center',
                            }}
                        >
                            {children}
                        </div>
                    </div>
                )}
                renderThumb={({ props, isDragged }) => (
                    <div
                        {...props}
                        style={{
                            ...props.style,
                            height: '50px',
                            width: '50px',
                            borderRadius: '6px',
                            backgroundColor: '#FFF',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            boxShadow: '0px 2px 6px #AAA',
                        }}
                    >
                        <div
                            style={{
                                height: '16px',
                                width: '5px',
                                backgroundColor: isDragged ? '#AC03F4' : '#CCC',
                            }}
                        />
                    </div>
                )}
            />
        )
    }
}
