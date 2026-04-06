import _ from 'lodash'
import { arrayMoveMutable } from 'array-move'

class MusicQueue {
    constructor(queue) {
        this.queue = {
            songs: [],
            currentIndex: null,
            audioDuration: 0,
        }
    }

    updateDuration() {
        this.queue.audioDuration = 0
        for (let song of this.queue.songs) {
            this.queue.audioDuration += song.AudioDuration ? song.AudioDuration : 0
        }
    }

    setApi(api) {
        return new Promise((resolve) => {
            this.api = api
            resolve()
        })
    }

    empty() {
        this.queue = {
            songs: [],
            currentIndex: null,
        }
        return this.serverWrite()
    }

    getQueue() {
        return this.queue
    }

    add(song) {
        if (!song) {
            return Promise.resolve()
        }
        return new Promise((resolve) => {
            let found = false
            let index = 0
            for (let entry of this.queue.songs) {
                if (entry.Id === song.Id) {
                    found = true
                    return resolve(index)
                }
                index++
            }
            if (!found) {
                this.queue.songs.push(song)
            }
            this.updateDuration()
            resolve(index)
        })
    }

    getCurrent() {
        if (this.queue.currentIndex === null) {
            return null
        }
        if (this.queue.currentIndex >= this.queue.songs.length) {
            this.queue.currentIndex = 0
        }
        return this.queue.songs[this.queue.currentIndex]
    }

    setCurrent(index) {
        this.queue.currentIndex = index
    }

    getNext() {
        if (!this.queue.currentIndex) {
            this.queue.currentIndex = 0
        }
        this.queue.currentIndex++
        return this.getCurrent()
    }

    moveItem(from, to) {
        arrayMoveMutable(this.queue.songs, from, to)
        if (this.queue.currentIndex != null) {
            if (this.queue.currentIndex === from) {
                this.queue.currentIndex = to
            } else {
                if (this.queue.currentIndex >= from && this.queue.currentIndex <= to) {
                    this.queue.currentIndex--
                }
                if (this.queue.currentIndex <= from && this.queue.currentIndex >= to) {
                    this.queue.currentIndex++
                }
            }
        }
    }

    remove(songIndex) {
        this.queue.songs.splice(songIndex, 1)
        if (this.queue.currentIndex != null) {
            if (songIndex < this.queue.currentIndex) {
                this.queue.currentIndex--
            } else {
                if (songIndex === this.queue.currentIndex) {
                    this.queue.currentIndex = null
                }
            }
        }
        this.updateDuration()
        return this.serverWrite()
    }

    shuffle() {
        this.queue.currentIndex = null
        this.queue.songs = _.shuffle(this.queue.songs)
        return this.serverWrite()
    }

    serverRead() {
        if (!this.api) {
            throw new Error('Unable to read music queue, no api has been set')
        }
        return this.api.getQueue().then((result) => {
            if (!_.isEmpty(result)) {
                this.queue = {
                    songs: result.songs,
                    currentIndex: result.currentIndex,
                }
            }
            this.updateDuration()
            return this.queue
        })
    }

    serverWrite() {
        if (!this.api) {
            throw new Error('Unable to persist music queue, no api has been set')
        }
        return this.api.setQueue(this.queue).then((result) => {
            return this.queue
        })
    }
}

let instance
if (!instance) {
    instance = new MusicQueue()
}

export default instance
