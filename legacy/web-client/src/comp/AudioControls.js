import React, { Component } from 'react'

import Comp from './'

export default class AudioControls extends Component {
    render() {
        if (!this.props.song) {
            return null
        }
        return (
            <div className="sticky-audio-controls centered">
                <div className="neighbor">
                    <Comp.CoverArt size="small" imageUrl={this.props.song.ThumbnailCoverArt} />
                </div>
                <div className="neighbor">
                    <p className="short-text" title={this.props.song.Title}>
                        {this.props.song.Title}
                    </p>
                    <p className="short-text" title={this.props.song.Album}>
                        {this.props.song.DisplayAlbum}
                    </p>
                    <p className="short-text" title={this.props.song.Artist}>
                        {this.props.song.DisplayArtist}
                    </p>
                </div>
                <br />
                <Comp.AudioPlayer song={this.props.song} songFinished={this.props.songFinished} />
            </div>
        )
    }
}
