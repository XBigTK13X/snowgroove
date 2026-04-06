import React, { Component } from 'react'
import Comp from '../comp'

export default class AlbumList extends Component {
    constructor(props) {
        super(props)

        this.state = {
            artists: null,
        }
    }

    componentDidMount() {
        this.props.api.getArtists(this.props.$stateParams.category).then((result) => {
            this.setState({
                artists: result.list,
            })
        })
    }

    render() {
        if (!this.state.artists) {
            return 'No entries found for this category'
        }
        return (
            <div>
                <h1>
                    {this.props.$stateParams.category} ({this.state.artists.length})
                </h1>
                <div className="list-grid">
                    {this.state.artists.map((artist, artistIndex) => {
                        return <Comp.ArtistListItem key={artistIndex} artist={artist} />
                    })}
                </div>
            </div>
        )
    }
}
