import React, { Component } from 'react'

import Comp from '../comp'

export default class RandomList extends Component {
    constructor(props) {
        super(props)

        this.state = {
            songs: null,
        }
    }

    componentDidMount() {
        this.props.api.getRandomList().then((result) => {
            this.setState({
                songs: result.songs,
            })
        })
    }

    render() {
        if (!this.state.songs) {
            return null
        }
        return (
            <div>
                <h1>Random Songs ({this.state.songs.length})</h1>
                <Comp.SongPicker api={this.props.api} addToQueue={this.props.addToQueue} songs={this.state.songs} playMedia={this.props.playMedia} />
            </div>
        )
    }
}
