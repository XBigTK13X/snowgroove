import React, { Component } from 'react'
import MicroModal from 'react-micro-modal'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFolderPlus } from '@fortawesome/free-solid-svg-icons'

import Comp from '../comp'

export default class ArtistView extends Component {
    constructor(props) {
        super(props)
        this.state = {
            albums: null,
            queueOptions: {
                Album: true,
                Single: true,
                Special: false,
                Collab: false,
            },
        }
        this.setQueueOption = this.setQueueOption.bind(this)
        this.addToQueue = this.addToQueue.bind(this)
    }

    setQueueOption(e) {
        let target = e.target.name
        let value = e.target.checked
        let options = { ...this.state.queueOptions }
        options[target] = value
        this.setState({
            queueOptions: options,
        })
    }

    addToQueue(closeModal) {
        let selectedAlbumSongs = []
        for (let listKind of this.state.albums.listKinds) {
            if (this.state.queueOptions[listKind]) {
                for (let albumSlug of this.state.albums.lists[listKind]) {
                    selectedAlbumSongs = selectedAlbumSongs.concat(this.state.albums.lookup[albumSlug].Songs)
                }
            }
        }
        selectedAlbumSongs.sort((a, b) => {
            if (a.ReleaseYear !== b.ReleaseYear) {
                return a.ReleaseYear > b.ReleaseYear ? 1 : -1
            }
            if (a.ReleaseYearSort !== b.ReleaseYearSort) {
                return a.ReleaseYearSort > b.ReleaseYearSort ? 1 : -1
            }
            if (a.Album !== b.Album) {
                return a.Album > b.Album ? 1 : -1
            }
            if (a.Disc !== b.Disc) {
                return a.Disc > b.Disc ? 1 : -1
            }
            return a.Track > b.Track ? 1 : -1
        })
        this.props.addToQueue(selectedAlbumSongs)
        closeModal()
    }

    componentDidMount() {
        this.props.api.getArtist(this.props.$stateParams.artist).then((result) => {
            this.setState({
                albums: result.albums,
                artist: decodeURIComponent(result.artist),
            })
        })
    }

    render() {
        if (!this.state.albums) {
            return null
        }

        return (
            <div>
                <h1>Artist - {this.state.artist}</h1>
                <MicroModal
                    trigger={(handleOpen) => (
                        <button className="icon-button" onClick={handleOpen} title="Add to queue">
                            <FontAwesomeIcon icon={faFolderPlus} />
                        </button>
                    )}
                    children={(handleClose) => (
                        <div>
                            <form
                                className="dialog-checklist"
                                onSubmit={(e) => {
                                    e.preventDefault()
                                }}
                            >
                                <label>
                                    Album
                                    <input name="Album" type="checkbox" checked={this.state.queueOptions.Album} onChange={this.setQueueOption} />
                                </label>
                                <label>
                                    Single
                                    <input name="Single" type="checkbox" checked={this.state.queueOptions.Single} onChange={this.setQueueOption} />
                                </label>
                                <label>
                                    Special
                                    <input name="Special" type="checkbox" checked={this.state.queueOptions.Special} onChange={this.setQueueOption} />
                                </label>
                                <label>
                                    Collab
                                    <input name="Collab" type="checkbox" checked={this.state.queueOptions.Collab} onChange={this.setQueueOption} />
                                </label>
                            </form>
                            <button
                                className="large-button"
                                onClick={() => {
                                    this.addToQueue(handleClose)
                                }}
                            >
                                Confirm
                            </button>
                            <button className="large-button" onClick={handleClose}>
                                Cancel
                            </button>
                        </div>
                    )}
                />

                {this.state.albums.listKinds.map((listKind, listKindIndex) => {
                    if (!this.state.albums.lists[listKind] || !this.state.albums.lists[listKind].length) {
                        return null
                    }
                    return (
                        <div key={listKindIndex}>
                            <h3>{listKind}</h3>
                            <Comp.AlbumPicker
                                albums={{
                                    list: this.state.albums.lists[listKind],
                                    lookup: this.state.albums.lookup,
                                }}
                            />
                        </div>
                    )
                })}
            </div>
        )
    }
}
