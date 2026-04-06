// Modified from https://github.com/binodswain/react-howler-player

import React, { Component } from 'react'
import { Howl } from 'howler'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlay, faPause, faVolumeUp, faVolumeMute } from '@fortawesome/free-solid-svg-icons'

import Comp from './'

const STATE = {
    PREPARE: 'PREPARE',
    READY: 'READY',
    ENDED: 'ENDED',
    PAUSE: 'PAUSE',
    PLAYING: 'PLAYING',
}

const STEP_MILLISECONDS = 400 //Originally 15

export default class AudioPlayer extends Component {
    constructor(props) {
        super(props)
        let storedVolume = localStorage.getItem('snowgloo-volume')
        if (storedVolume !== null) {
            storedVolume = parseInt(storedVolume, 10)
        } else {
            storedVolume = 0
        }
        this.state = {
            sound: null,
            playerState: STATE.PREPARE,
            song: null,
            progressValue: 0,
            currentPos: '0:00',
            volume: storedVolume,
            isMute: false,
        }
        this.stepInterval = null
    }

    componentDidMount() {
        this.setupPlayer()
    }

    componentWillUnmount() {
        this.destroySound()
    }

    componentDidUpdate(prevProps, prevState) {
        if (prevProps.song.Id !== this.props.song.Id) {
            this.setupPlayer()
        }
    }

    toggleMute = () => {
        this.setState((prevState) => {
            const { volume, sound } = prevState

            if (volume === 0 || !prevState.isMute) {
                sound.mute(true)
                return { isMute: true }
            }
            sound.mute(false)
            return { isMute: !prevState.isMute }
        })
    }

    readyToPlay = () => {
        const { playerState, sound } = this.state
        if (playerState === STATE.PLAYING) {
            return
        }
        this.setState({
            playerState: STATE.READY,
            duration: this.formatTime(Math.round(sound.duration())),
        })
    }

    setupPlayer = () => {
        if (!this.props.song || (this.state.song && this.props.song.Id === this.state.song.Id)) {
            return
        }

        this.destroySound().then(() => {
            const { song, format = ['wav', 'mp3', 'flac', 'aac', 'm4a'] } = this.props

            let sound = new Howl({
                src: [song.AudioUrl],
                format,
                autoplay: true,
                html5: true,
            })

            let targetVolume = Math.round(this.state.volume) / 100
            sound.volume(targetVolume)

            sound.once('load', this.readyToPlay)

            sound.on('end', () => {
                this.playbackEnded()
                this.props.songFinished()
            })

            sound.on('play', () => {
                this.stepInterval = setInterval(this.step, STEP_MILLISECONDS)
            })

            this.setState({
                sound,
                playerState: STATE.PREPARE,
                progressValue: 0,
                currentPos: '0:00',
                song,
            })
        })
    }

    playbackEnded = () => {
        const { onTimeUpdate } = this.props
        const { duration } = this.state
        if (onTimeUpdate) {
            let playerState = {
                currentTime: this.state.sound.duration(),
                progressPercent: 100,
            }
            onTimeUpdate(playerState)
        }
        if (this.stepInterval) {
            clearInterval(this.stepInterval)
        }
        this.setState({
            playerState: STATE.ENDED,
            progressValue: 100,
            currentPos: duration,
        })
    }

    playbackPlay = () => {
        const { sound } = this.state
        sound.play()
        this.setState({
            playerState: STATE.PLAYING,
        })
    }

    playbackPause = () => {
        const { sound } = this.state
        sound.pause()
        if (this.stepInterval) {
            clearInterval(this.stepInterval)
        }
        this.setState({
            playerState: STATE.PAUSE,
        })
    }

    formatTime = (secs) => {
        var minutes = Math.floor(secs / 60) || 0
        var seconds = secs - minutes * 60 || 0

        return minutes + ':' + (seconds < 10 ? '0' : '') + seconds
    }

    seek = (value) => {
        //Prevent scrubbing to end, triggering next song start
        if (value === 100) {
            value = this.state.progressValue
        }
        const { sound } = this.state
        let percent = value / 100
        let timeLocation = sound.duration() * percent
        sound.seek(timeLocation)
        let currentSeek = sound.seek() || 0
        this.setState({
            progressValue: value,
            currentPos: this.formatTime(Math.round(currentSeek)),
        })
    }

    step = () => {
        let { sound } = this.state
        // If the sound is still playing, continue stepping. Unless a user is seeking.
        if (sound.playing() && !window.isMouseDown) {
            const { onTimeUpdate } = this.props

            var seek = sound.seek() || 0

            let percentage = (seek / sound.duration()) * 100 || 0
            this.setState({
                progressValue: percentage.toFixed(3),
                currentPos: this.formatTime(Math.round(seek)),
                playerState: STATE.PLAYING,
            })
            if (onTimeUpdate) {
                let playerState = {
                    currentTime: seek,
                    progressPercent: Number(percentage.toFixed(3)),
                }
                onTimeUpdate(playerState)
            }
        }
    }

    changeVolume = (volume) => {
        let targetVolume = Math.round(volume) / 100
        this.state.sound.volume(targetVolume)

        localStorage.setItem('snowgloo-volume', volume)

        this.setState({
            volume,
            isMute: Number(volume) === 0,
        })
    }

    destroySound = () => {
        return new Promise((resolve) => {
            const { sound } = this.state
            if (this.stepInterval) {
                clearInterval(this.stepInterval)
            }
            if (sound) {
                sound.unload()
            }
            resolve()
        })
    }

    render() {
        const { playerState, duration, currentPos, isMute } = this.state

        let playPauseAction
        let playPauseIcon

        if (playerState === STATE.READY || playerState === STATE.PAUSE || playerState === STATE.ENDED) {
            playPauseAction = this.playbackPlay
            playPauseIcon = <FontAwesomeIcon icon={faPlay} />
        } else if (playerState === STATE.PLAYING) {
            playPauseAction = this.playbackPause
            playPauseIcon = <FontAwesomeIcon icon={faPause} />
        }

        let volumeIcon = isMute ? <FontAwesomeIcon icon={faVolumeMute} /> : <FontAwesomeIcon icon={faVolumeUp} />

        return (
            <div>
                <div className="seek-range">
                    <Comp.RangeInput value={this.state.progressValue} onChange={this.seek} />
                </div>
                <div className="audio-duration">
                    {currentPos} <span className="duration">/ {duration || '...'}</span>
                </div>
                <button className="audio-button no-focus" onClick={playPauseAction}>
                    {playPauseIcon}
                </button>
                <div className="volume-range">
                    <Comp.RangeInput value={isMute ? 0 : this.state.volume} onChange={this.changeVolume} />
                </div>
                <button className="audio-button no-focus" onClick={this.toggleMute}>
                    {volumeIcon}
                </button>
            </div>
        )
    }
}
