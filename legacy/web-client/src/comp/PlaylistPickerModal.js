import React, { Component } from 'react'

import MicroModal from 'react-micro-modal'

export default class PlaylistPickerModal extends Component {
    constructor(props) {
        super(props)

        this.state = {
            playlists: null,
            alreadyInPlaylist: false,
        }
        this.loadPlaylists = this.loadPlaylists.bind(this)
        this.addToPlaylist = this.addToPlaylist.bind(this)
        this.selectPlaylist = this.selectPlaylist.bind(this)
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

    addToPlaylist(playlistId) {
        return this.props.api.addToPlaylist(playlistId, this.props.song.Id)
    }

    selectPlaylist(e) {
        let playlistId = e.target.value
        this.setState({ alreadyInPlaylist: false })
        this.addToPlaylist(playlistId, this.props.song.id).then((result) => {
            if (result && result.error && result.error.indexOf('Already') !== -1) {
                this.setState({
                    alreadyInPlaylist: true,
                })
            } else {
                this.props.handleParentClose()
            }
        })
    }

    render() {
        if (!this.state.playlists) {
            return null
        }
        return (
            <MicroModal
                trigger={(handleOpen) => (
                    <button className="context-menu-button" onClick={handleOpen} title="Open the action menu">
                        Add to Playlist
                    </button>
                )}
                children={(handleClose) => (
                    <div>
                        {this.state.alreadyInPlaylist ? <p>Already in playlist. Try again.</p> : null}
                        <label>
                            Select a playlist:{' '}
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
                        <button className="context-menu-button" onClick={handleClose}>
                            Cancel
                        </button>
                    </div>
                )}
            />
        )
    }
}
