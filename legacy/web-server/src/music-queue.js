const database = require('./database')
const settings = require('./settings')
const util = require('./util')
const _ = require('lodash')

class MusicQueue {
    read(user) {
        if (!user) {
            throw new Error('Unable to read queue.', { user })
        }
        return database.getInstance(`queue-${user}`).read()
    }

    write(user, queue) {
        if (!user || !queue) {
            throw new Error('Unable to persist queue.', { user, queue })
        }
        return database.getInstance(`queue-${user}`).write(queue)
    }

    clear(user) {
        return this.write(user, {
            songs: [],
            currentIndex: null,
        })
    }

    clearAll() {
        for (let user of settings.userList) {
            this.clear(user)
        }
    }

    getM3U(username){
        return new Promise((resolve)=>{
            this.read(username)
            .then(queue=>{
                let m3u = `#EXTM3U\n#PLAYLIST:${username}'s Queue`
                queue.songs = _.shuffle(queue.songs)
                for(let song of queue.songs){
                    m3u += util.m3uEntry(song)
                }
                return resolve(m3u)
            })
        })
    }
}

let instance
if (!instance) {
    instance = new MusicQueue()
}

module.exports = instance
