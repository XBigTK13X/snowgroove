import React, { Component } from 'react'

import Comp from './'

export default class ArtistListItem extends Component {
    render() {
        return (
            <Comp.Href to="artist-view" params={{ artist: this.props.artist }}>
                <a href="/">
                    <div className="list-item-small">{this.props.artist}</div>
                </a>
            </Comp.Href>
        )
    }
}
