import React, { Component } from 'react'

import Comp from './'

export default class AlbumListItem extends Component {
    render() {
        if (!this.props.album) {
            return null
        }
        return (
            <Comp.Href to="album-view" params={{ albumSlug: this.props.album.AlbumSlug }}>
                <a href="/">
                    <div className="list-item">
                        <Comp.CoverArt imageUrl={this.props.album.ThumbnailCoverArt} />
                        <p className="truncate">
                            {this.props.album.DisplayAlbum} ({this.props.album.ReleaseYear})
                        </p>
                        <p className="truncate">{this.props.album.DisplayArtist}</p>
                    </div>
                </a>
            </Comp.Href>
        )
    }
}
