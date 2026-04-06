import React, { Component } from 'react'
import { UIRouter, UIView, pushStateLocationPlugin } from '@uirouter/react'
import routes from './routes'
import Comp from './comp'
import service from './service'
import settings from './settings'

for (let route of routes) {
    if (!route.component) {
        console.error({ route })
        throw new Error(`Route is missing component`)
    }
    if (!route.name) {
        console.error({ route })
        throw new Error(`Route is missing name`)
    }
    if (!route.url) {
        console.error({ route })
        throw new Error(`Route is missing url`)
    }
}

const plugins = [pushStateLocationPlugin]

const configRouter = (router) => {
    router.urlRouter.otherwise('/')
}

export default class App extends Component {
    constructor(props) {
        super(props)

        let user = service.user.getUser()

        if (user) {
            service.api.setUser(user)
        }

        this.state = {
            audioUrl: null,
            user: user,
            queue: {
                songs: null,
                currentIndex: null,
            },
        }

        this.playMedia = this.playMedia.bind(this)
        this.login = this.login.bind(this)
        this.emptyQueue = this.emptyQueue.bind(this)
        this.songFinished = this.songFinished.bind(this)
        this.addToQueue = this.addToQueue.bind(this)
        this.shuffleQueue = this.shuffleQueue.bind(this)
        this.updateSongList = this.updateSongList.bind(this)
        this.removeItem = this.removeItem.bind(this)
    }

    componentDidMount() {
        service.musicQueue.setApi(service.api).then(() => {
            service.musicQueue.serverRead().then((queue) => {
                queue.currentIndex = null
                this.setState({
                    queue: queue,
                })
            })
        })
    }

    login(user) {
        service.user.login(user)
        service.api.setUser(user)
        service.musicQueue.serverRead().then((queue) => {
            this.setState({
                user,
                queue,
            })
        })
    }

    logout() {
        service.user.logout()
        service.api.setUser(null)
        this.setState({
            user: null,
        })
    }

    playMedia(song) {
        service.musicQueue.add(song).then((songIndex) => {
            service.musicQueue.setCurrent(songIndex)
            service.musicQueue.serverWrite().then((queue) => {
                this.setState({
                    song,
                    queue,
                })
            })
        })
    }

    addToQueue(songs) {
        if (songs.constructor === Array) {
            for (let song of songs) {
                if (song.AudioDuration <= settings.songDurationMinimumSeconds) {
                    continue
                }
                service.musicQueue.add(song)
            }
        } else {
            service.musicQueue.add(songs)
        }

        service.musicQueue.serverWrite().then((queue) => {
            this.setState({
                queue,
            })
        })
    }

    removeItem(songIndex) {
        service.musicQueue.remove(songIndex).then((queue) => {
            this.setState({
                queue,
                song: service.musicQueue.getCurrent(),
            })
        })
    }

    songFinished() {
        let nextSong = service.musicQueue.getNext()
        this.playMedia(nextSong)
    }

    emptyQueue() {
        service.musicQueue.empty().then((queue) => {
            this.setState({
                queue,
                song: null,
            })
        })
    }

    shuffleQueue() {
        service.musicQueue.shuffle().then((queue) => {
            this.setState({
                queue,
                song: null,
            })
        })
    }

    updateSongList(result, provided) {
        service.musicQueue.moveItem(result.source.index, result.destination.index)
        this.setState({
            queue: service.musicQueue.getQueue(),
        })
        service.musicQueue.serverWrite()
    }

    render() {
        if (!this.state.user) {
            return (
                <div>
                    <Comp.LoginForm login={this.login} />
                </div>
            )
        }
        return (
            <div>
                <UIRouter plugins={plugins} states={routes} config={configRouter}>
                    <div className="page-wrapper">
                        <Comp.NavBar logout={this.logout} />
                        <br />
                        <UIView
                            render={(Component, props) => {
                                return (
                                    <Component
                                        {...props}
                                        playMedia={this.playMedia}
                                        api={service.api}
                                        user={this.state.user}
                                        queuedSongs={this.state.queue.songs}
                                        emptyQueue={this.emptyQueue}
                                        playingIndex={this.state.queue.currentIndex}
                                        queueDuration={this.state.queue.audioDuration}
                                        addToQueue={this.addToQueue}
                                        shuffleQueue={this.shuffleQueue}
                                        updateSongList={this.updateSongList}
                                        removeItem={this.removeItem}
                                    />
                                )
                            }}
                        />
                    </div>
                    <Comp.AudioControls api={service.api} song={this.state.song} songFinished={this.songFinished} />
                </UIRouter>
            </div>
        )
    }
}
