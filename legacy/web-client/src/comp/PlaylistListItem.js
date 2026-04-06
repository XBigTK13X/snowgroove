import React, { Component } from 'react'

import Comp from './'

export default class PlaylistListItem extends Component {
    render() {
        return (
            <Comp.Href to="playlist-view" params={{ playlistId: this.props.playlist.id }}>
                <a href="/">
                    <div className="list-item-small">{this.props.playlist.name}</div>
                </a>
            </Comp.Href>
        )
    }
}
