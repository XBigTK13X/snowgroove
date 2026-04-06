import React, { Component } from 'react'

import Comp from '../comp'

export default class AlbumView extends Component {
    constructor(props) {
        super(props)

        this.state = {
            album: null,
        }
    }

    componentDidMount() {
        this.props.api.getAlbum(this.props.$stateParams.albumSlug).then((result) => {
            this.setState({
                album: result.album,
            })
        })
    }

    render() {
        if (!this.state.album) {
            return null
        }
        return (
            <div>
                <h1>
                    Album - {this.state.album.DisplayAlbum} from {this.state.album.DisplayArtist}
                </h1>
                <Comp.SongPicker api={this.props.api} addToQueue={this.props.addToQueue} songs={this.state.album.Songs} playMedia={this.props.playMedia} />
            </div>
        )
    }
}
