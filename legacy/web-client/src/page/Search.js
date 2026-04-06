import React, { Component } from 'react'
import debounce from 'debounce'
import settings from '../settings'
import qs from 'query-string'
import Comp from '../comp'

export default class Search extends Component {
    constructor(props) {
        super(props)
        this.state = {
            query: '',
            results: null,
            searching: false,
        }
        this.onChange = this.onChange.bind(this)
        this.search = debounce((query) => {
            this.setState({ searching: true })
            let targetUrl = '/search?' + qs.stringify({ query })
            window.history.replaceState(null, null, targetUrl)
            this.props.api.search(query).then((results) => {
                this.setState({
                    results,
                    searching: false,
                })
            })
        }, settings.debounceMilliseconds)
    }

    componentDidMount() {
        let query = qs.parse(window.location.search).query || ''
        if (query) {
            this.setState({
                query,
            })
            this.search(query)
        }
    }

    onChange(e) {
        this.setState({
            query: e.target.value,
        })
        if (e.target.value && e.target.value.length > 2) {
            this.search(e.target.value)
        }
    }

    render() {
        let artists =
            this.state.results && this.state.results.Artists.length ? (
                <div>
                    <h3>
                        {this.state.results.Artists.length} Artist{this.state.results.Artists.length > 1 ? 's' : ''}
                    </h3>
                    <div className="list-grid">
                        {this.state.results.Artists.map((artist, artistIndex) => {
                            return <Comp.ArtistListItem key={artistIndex} artist={artist.Artist} playMedia={this.props.playMedia} />
                        })}
                    </div>
                </div>
            ) : null
        let albums =
            this.state.results && this.state.results.Albums.length ? (
                <div>
                    <h3>
                        {this.state.results.Albums.length} Album{this.state.results.Albums.length > 1 ? 's' : ''}
                    </h3>
                    <div className="list-grid">
                        {this.state.results.Albums.map((album, artistIndex) => {
                            return <Comp.AlbumListItem key={artistIndex} album={album} playMedia={this.props.playMedia} />
                        })}
                    </div>
                </div>
            ) : null
        let songs =
            this.state.results && this.state.results.Songs.length ? (
                <div>
                    <h3>
                        {this.state.results.Songs.length} Song{this.state.results.Songs.length > 1 ? 's' : ''}
                    </h3>
                    <Comp.SongPicker api={this.props.api} songs={this.state.results.Songs} playMedia={this.props.playMedia} addToQueue={this.props.addToQueue} />
                </div>
            ) : null
        let playlists =
            this.state.results && this.state.results.Playlists.list.length ? (
                <div>
                    <h3>
                        {this.state.results.Playlists.list.length} Playlist{this.state.results.Playlists.list.length > 1 ? 's' : ''}
                    </h3>
                    <div className="list-grid">
                        {this.state.results.Playlists.list.map((playlist, playlistIndex) => {
                            return <Comp.PlaylistListItem key={playlistIndex} playlist={playlist} />
                        })}
                    </div>
                </div>
            ) : null
        let results = this.state.searching ? (
            'Loading...'
        ) : this.state.results && this.state.results.ItemCount > 0 ? (
            <div>
                {playlists}
                {artists}
                {albums}
                {songs}
            </div>
        ) : this.state.query ? (
            <p>No results found for "{this.state.query}"</p>
        ) : null
        return (
            <div>
                <h1>Search</h1>
                <input className="large-text-input" autoFocus={true} type="text" value={this.state.query} onChange={this.onChange} />
                <br />
                {results}
            </div>
        )
    }
}
