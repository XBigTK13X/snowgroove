import React, { Component } from 'react'
import Comp from '../comp'

export default class ArtistList extends Component {
    constructor(props) {
        super(props)

        this.state = {
            albums: {},
        }
    }

    componentDidMount() {
        this.props.api.getAlbums().then((result) => {
            this.setState({
                albums: result.albums,
            })
        })
    }

    render() {
        if (!this.state.albums.list) {
            return null
        }
        return (
            <div>
                <h1>Albums ({this.state.albums.list.length})</h1>
                <Comp.AlbumPicker albums={this.state.albums} />
            </div>
        )
    }
}
