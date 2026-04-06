const util = require('./util')

class MusicArtist {
    constructor(musicFile) {
        if (!musicFile) {
            return this
        }
        this.Artist = musicFile.Artist
        this.DisplayArtist = musicFile.DisplayArtist
        this.SearchArtist = util.searchify(this.Artist + this.DisplayArtist)
    }

    rehydrate(instance) {
        Object.assign(this, instance)
        return this
    }

    matches(query) {
        return this.SearchArtist.includes(query)
    }
}

module.exports = MusicArtist
