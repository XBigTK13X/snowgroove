import { Component } from 'react'

import util from '../util'

export default class SongDuration extends Component {
    render() {
        if (!this.props.song.AudioDuration) {
            return '[Unknown]'
        }
        return `${util.secondsToTimeStamp(this.props.song.AudioDuration)}`
    }
}
