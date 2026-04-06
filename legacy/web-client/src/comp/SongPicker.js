import React, { Component } from 'react'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFolderPlus } from '@fortawesome/free-solid-svg-icons'
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd'

import Comp from './'

export default class SongPicker extends Component {
    render() {
        let queueButton = !this.props.hideQueueButton ? (
            <button
                className="icon-button"
                onClick={() => {
                    this.props.addToQueue(this.props.songs)
                }}
                title="Add to queue"
            >
                <FontAwesomeIcon icon={faFolderPlus} />
            </button>
        ) : null
        let title = this.props.title ? <h3>{this.props.title}</h3> : null
        return (
            <div>
                {title}
                {queueButton}
                <DragDropContext onDragEnd={this.props.updateSongList}>
                    <table>
                        <thead>
                            <tr>
                                <th className="small-cell">Actions</th>
                                <th className="small-cell">Cover</th>
                                <th className="medium-cell">Title</th>
                                <th className="medium-cell">Album</th>
                                <th className="medium-cell">Artist</th>
                                <th className="small-cell">Duration</th>
                                {this.props.updateSongList ? <th className="small-cell">Reorder</th> : null}
                            </tr>
                        </thead>
                        <Droppable droppableId="song-picker" isDropDisabled={!this.props.updateSongList}>
                            {(provided, snapshot) => {
                                return (
                                    <tbody ref={provided.innerRef}>
                                        {this.props.songs.map((song, songIndex) => {
                                            return (
                                                <Draggable key={song.Id} isDragDisabled={!this.props.updateSongList} draggableId={song.Id} id={song.Id} index={songIndex}>
                                                    {(provided, snapshot) => {
                                                        return (
                                                            <Comp.SongPickerItem
                                                                innerRef={provided.innerRef}
                                                                provided={provided}
                                                                song={song}
                                                                playMedia={this.props.playMedia}
                                                                alternate={songIndex % 2 === 0}
                                                                api={this.props.api}
                                                                nowPlaying={songIndex === this.props.playingIndex}
                                                                songIndex={songIndex}
                                                                removeItem={this.props.removeItem}
                                                                addToQueue={this.props.addToQueue}
                                                                updateSongList={this.props.updateSongList}
                                                            />
                                                        )
                                                    }}
                                                </Draggable>
                                            )
                                        })}
                                        {provided.placeholder}
                                    </tbody>
                                )
                            }}
                        </Droppable>
                    </table>
                </DragDropContext>
            </div>
        )
    }
}
