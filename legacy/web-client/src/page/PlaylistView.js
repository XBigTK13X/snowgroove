import React, { Component } from 'react'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSave, faTrashAlt } from '@fortawesome/free-solid-svg-icons'

import Comp from '../comp'

export default class PlaylistView extends Component {
    constructor(props) {
        super(props)

        this.state = {
            playlist: null,
            playlistName: '',
            deleting: false,
        }

        this.changePlaylistName = this.changePlaylistName.bind(this)
        this.savePlaylist = this.savePlaylist.bind(this)
        this.deletePlaylist = this.deletePlaylist.bind(this)
    }

    componentDidMount() {
        this.props.api.getPlaylist(this.props.$stateParams.playlistId).then((result) => {
            this.setState({
                playlist: result,
            })
        })
    }

    changePlaylistName(e) {
        this.setState({
            playlistName: e.target.value,
        })
    }

    savePlaylist(playlist) {
        if (!playlist) {
            playlist = { ...this.state.playlist }
            if (this.state.playlistName) {
                playlist.name = this.state.playlistName
            }
        }
        return this.props.api.savePlaylist(playlist).then((savedPlaylist) => {
            this.setState({
                playlist: savedPlaylist,
                playlistName: '',
            })
        })
    }

    deletePlaylist() {
        let playlist = { ...this.state.playlist }
        this.setState({
            playlist: null,
            deleting: true,
        })
        playlist.deleted = true
        this.savePlaylist(playlist).then(() => {
            this.props.$transition$.router.stateService.go('playlist-list')
        })
    }

    render() {
        if (this.state.deleting) {
            return 'Deleting the playlist. Please wait one moment.'
        }
        if (!this.state.playlist) {
            return null
        }
        let m3uUrl = `${this.props.api.baseURL.replace(/"/g,'')}playlist/${this.props.$stateParams.playlistId}/playlist.m3u`
        return (
            <div>
                <h1>Playlist - {this.state.playlist.name}</h1>
                <h2>M3U - {m3uUrl}</h2>
                <div>
                    <label>
                        Change playlist name
                        <input type="text" onChange={this.changePlaylistName} value={this.state.playlistName} />
                    </label>
                    {this.state.playlistName.length > 2 ? (
                        <button
                            className="icon-button"
                            onClick={() => {
                                this.savePlaylist()
                            }}
                            title="Save the playlist name"
                        >
                            <FontAwesomeIcon icon={faSave} />
                        </button>
                    ) : null}
                </div>
                <hr />
                <button className="icon-button" onClick={this.deletePlaylist} title="Delete the playlist">
                    <FontAwesomeIcon icon={faTrashAlt} />
                </button>
                <hr />
                <Comp.SongPicker api={this.props.api} title={this.state.playlist.name} addToQueue={this.props.addToQueue} songs={this.state.playlist.songs} playMedia={this.props.playMedia} />
            </div>
        )
    }
}
