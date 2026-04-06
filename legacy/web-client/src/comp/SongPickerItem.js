import React, { Component } from 'react'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faAlignJustify, faMusic } from '@fortawesome/free-solid-svg-icons'
import MicroModal from 'react-micro-modal'

import Comp from './'

export default class SongPickerItem extends Component {
    constructor(props) {
        super(props)
        this.handleClick = this.handleClick.bind(this)
    }
    handleClick(e) {
        const kind = e.target.getAttribute('data-kind')
        if (kind === 'play') {
            this.props.playMedia(this.props.song)
        }
    }

    render() {
        if (!this.props.song) {
            return null
        }
        let style = 'list-item-text'
        if (this.props.alternate && !this.props.nowPlaying) {
            style += ' odd-row'
        } else {
            style += ' even-row'
        }
        if (this.props.nowPlaying) {
            style += ' highlighted-row'
        }
        return (
            <tr {...this.props.provided.draggableProps} ref={this.props.innerRef} className={style} onClick={this.handleClick}>
                <td data-kind="action-menu" className="centered small-cell">
                    <MicroModal
                        trigger={(handleOpen) => (
                            <button className="small-icon-button" onClick={handleOpen} title="Open the action menu">
                                <FontAwesomeIcon icon={faMusic} />
                            </button>
                        )}
                        children={(handleClose) => (
                            <div>
                                <Comp.LinkButton buttonClass="context-menu-button" to="album-view" params={{ albumSlug: this.props.song.AlbumSlug }} text="View Album" />
                                <Comp.LinkButton buttonClass="context-menu-button" to="artist-view" params={{ artist: this.props.song.Artist }} text="View Artist" />
                                {this.props.removeItem ? (
                                    <button
                                        className="context-menu-button"
                                        onClick={() => {
                                            this.props.removeItem(this.props.songIndex)
                                            handleClose()
                                        }}
                                    >
                                        Remove
                                    </button>
                                ) : null}
                                {this.props.addToQueue ? (
                                    <button
                                        className="context-menu-button"
                                        onClick={() => {
                                            this.props.addToQueue(this.props.song)
                                            handleClose()
                                        }}
                                    >
                                        Queue Up
                                    </button>
                                ) : null}
                                <Comp.PlaylistPickerModal api={this.props.api} song={this.props.song} handleParentClose={handleClose} />
                                <button className="context-menu-button" onClick={handleClose}>
                                    Cancel
                                </button>
                            </div>
                        )}
                    />
                </td>
                <td data-kind="play" className="small-cell">
                    <div className="inline-cover-art" data-kind="play">
                        <img src={this.props.song.ThumbnailCoverArt} alt="cover art" className="inline-cover-art-img" data-kind="play" />
                    </div>
                </td>
                <td data-kind="play" className="medium-cell">
                    {this.props.song.Title}
                </td>
                <td data-kind="play" className="medium-cell">
                    {this.props.song.DisplayAlbum}
                </td>
                <td data-kind="play" className="medium-cell">
                    {this.props.song.DisplayArtist}
                </td>
                <td data-kind="play" className="small-cell">
                    <Comp.SongDuration song={this.props.song} />
                </td>
                {this.props.updateSongList ? (
                    <td data-kind="reorder" {...this.props.provided.dragHandleProps} className="centered small-cell">
                        <div className="small-icon-button" title="Drag to reorder">
                            <FontAwesomeIcon icon={faAlignJustify} />
                        </div>
                    </td>
                ) : null}
            </tr>
        )
    }
}
