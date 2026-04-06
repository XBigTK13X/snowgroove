import React, { Component } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSave } from '@fortawesome/free-solid-svg-icons'

import Comp from '../comp'

export default class PlaylistList extends Component {
    constructor(props) {
        super(props)

        this.state = {
            playlists: null,
            playlistName: '',
            selectedPlaylistId: 'null',
            selectedPlaylistName: null,
        }

        this.changePlaylistName = this.changePlaylistName.bind(this)
        this.selectPlaylist = this.selectPlaylist.bind(this)
        this.savePlaylist = this.savePlaylist.bind(this)
        this.loadPlaylists = this.loadPlaylists.bind(this)
    }

    componentDidMount() {
        this.loadPlaylists()
    }

    loadPlaylists() {
        this.props.api.getPlaylists().then((result) => {
            this.setState({
                playlists: result.list,
            })
        })
    }

    changePlaylistName(event) {
        this.setState({
            playlistName: event.target.value,
            selectedPlaylistId: 'null',
            selectedPlaylistName: null,
        })
    }

    selectPlaylist(event) {
        let targetPlaylist = this.state.playlists.filter((x) => {
            return x.id === event.target.value
        })[0]
        this.setState({
            playlistName: '',
            selectedPlaylistId: targetPlaylist.id,
            selectedPlaylistName: targetPlaylist.name,
        })
    }

    savePlaylist() {
        let playlist = {
            name: this.state.selectedPlaylistName !== null ? this.state.selectedPlaylistName : this.state.playlistName,
            id: this.state.selectedPlaylistId === 'null' ? null : this.state.selectedPlaylistId,
            songs: this.props.queuedSongs,
        }
        this.props.api
            .savePlaylist(playlist)
            .then(() => {
                this.loadPlaylists()
            })
            .catch((err) => {
                console.error(err)
            })
    }

    render() {
        let playlists =
            !this.state.playlists || !this.state.playlists.length ? (
                'No playlists found.'
            ) : (
                <div className="list-grid">
                    {this.state.playlists.map((playlist, playlistIndex) => {
                        return <Comp.PlaylistListItem key={playlistIndex} playlist={playlist} />
                    })}
                </div>
            )

        return (
            <div>
                <h1>Playlists</h1>

                <div>
                    Save current queue as a playlist.
                    <br />
                    <br />
                    <label>
                        New playlist: <input placeholder="New playlist name" type="text" value={this.state.playlistName} onChange={this.changePlaylistName} />
                    </label>
                    {this.props.queuedSongs && this.props.queuedSongs.length && this.state.playlists ? (
                        <div>
                            <br />
                            <label>
                                Existing playlist:{' '}
                                <select value={this.state.selectedPlaylistId} onChange={this.selectPlaylist}>
                                    <option value={'null'} key={-1} name={'null'}></option>
                                    {this.state.playlists.map((playlist, playlistIndex) => {
                                        return (
                                            <option value={playlist.id} key={playlistIndex} name={playlist.name}>
                                                {playlist.name}
                                            </option>
                                        )
                                    })}
                                </select>
                            </label>
                            <br />
                        </div>
                    ) : (
                        <p>Put something in the queue to update an existing playlist</p>
                    )}
                </div>

                {this.state.playlistName.length > 2 || this.state.selectedPlaylistId !== 'null' ? (
                    <button className="icon-button" onClick={this.savePlaylist} title="Open the playlist menu">
                        <FontAwesomeIcon icon={faSave} />
                    </button>
                ) : null}
                <hr />
                <br />
                {playlists}
            </div>
        )
    }
}
