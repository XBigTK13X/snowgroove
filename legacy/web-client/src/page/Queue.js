import React, { Component } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faRandom, faTrashAlt } from '@fortawesome/free-solid-svg-icons'

import Comp from '../comp'
import util from '../util'

export default class Queue extends Component {
    constructor(props) {
        super(props)
        this.state = {
            playlists: null,
            newPlaylistName: '',
        }
    }

    render() {
        if (!this.props.queuedSongs || !this.props.queuedSongs.length) {
            return (
                <div>
                    <h1>{this.props.user}'s Queue</h1>
                    <p>{this.props.user} has no music queued up.</p>
                </div>
            )
        }
        let m3uUrl = `${this.props.api.baseURL.replace(/"/g,'')}queue/${this.props.user}/playlist.m3u`
        return (
            <div>
                <h1>
                    {this.props.user}'s Queue {this.props.queuedSongs.length === 1 ? '(1 song)' : `(${this.props.queuedSongs.length} songs)`}
                    {this.props.queueDuration ? `[${util.secondsToTimeStamp(this.props.queueDuration)}]` : ''}
                </h1>
                <h2>M3U - {m3uUrl}</h2>

                <button className="icon-button" onClick={this.props.shuffleQueue} title="Shuffle the queue">
                    <FontAwesomeIcon icon={faRandom} />
                </button>
                <button className="icon-button" onClick={this.props.emptyQueue} title="Empty the queue">
                    <FontAwesomeIcon icon={faTrashAlt} />
                </button>
                <Comp.SongPicker api={this.props.api} hideQueueButton songs={this.props.queuedSongs} playMedia={this.props.playMedia} playingIndex={this.props.playingIndex} updateSongList={this.props.updateSongList} removeItem={this.props.removeItem} />
            </div>
        )
    }
}
