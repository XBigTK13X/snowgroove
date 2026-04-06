import React, { Component } from 'react'

import Comp from './'

export default class AlbumPicker extends Component {
    render() {
        return (
            <div className="list-grid">
                {this.props.albums.list.map((album, albumIndex) => {
                    return <Comp.AlbumListItem key={albumIndex} album={this.props.albums.lookup[album]} />
                })}
            </div>
        )
    }
}
