import LocalPlayer from './local-player'
import RemotePlayer from './remote-player'
import QueueManager from './queue-manager'

export class CrossAudioControls {
    constructor() {
        this.eventEmitter = null
        this.apiClient = null
        this.config = null
        this.targetPlayerId = null
        this.targetPlayerName = null
        this.player = null
        this.localPlayer = null
        this.remotePlayer = null
        this.queueManager = null
        this.currentFingerprint = null
        this.progressTimer = null
        this.lastStatus = null
        this.playerState = {
            is_playing: false,
            position_seconds: 0,
            duration_seconds: 0,
            volume: 0.0,
            player_state: 'stopped'
        }
    }

    setEventEmitter(emitter) {
        this.eventEmitter = emitter
    }

    configure(apiClient, appConfig) {
        this.apiClient = apiClient
        this.config = appConfig

        this.queueManager = new QueueManager({
            apiClient: this.apiClient,
            eventEmitter: this.eventEmitter,
            config: this.config
        })

        this.localPlayer = new LocalPlayer({
            eventEmitter: this.eventEmitter,
            config: this.config,
            onStateChange: (playerState) => {
                this.updateState(playerState)
            },
            onTrackFinished: () => {
                if (this.config?.debugAudioContext) {
                    this.eventEmitter.emit('log', {
                        nativeOwner: 'CrossAudioControls->onTrackFinished',
                        message: 'Current track finished'
                    })
                }
                const nextSong = this.queueManager.advanceSong(1)
                if (nextSong) {
                    this.loadAndPlay()
                } else {
                    this.eventEmitter.emit('playbackComplete')
                    this.eventEmitter.emit('finished')
                }
            }
        })

        this.remotePlayer = new RemotePlayer({
            eventEmitter: this.eventEmitter,
            config: this.config,
            apiClient: this.apiClient,
            onStateChange: (playerState) => {
                this.updateState(playerState)
            }
        })

        this.player = this.localPlayer
        this.localPlayer.activate()

        this.eventEmitter.emit('apiConfigured')
        this.startProgressLoop()
    }

    updateState(newState) {
        this.playerState = { ...this.playerState, ...newState }
        this.eventEmitter.emit('statusUpdate', this.playerState)
    }

    async changeTargetPlayer(id, name) {
        this.targetPlayerId = id
        this.targetPlayerName = name

        if (this.player !== null) {
            this.player.deactivate()
        }

        if (this.targetPlayerId === null || this.targetPlayerId === undefined) {
            this.player = this.localPlayer
        } else {
            this.player = this.remotePlayer
        }

        this.player.activate({ id, name })

        const session = await this.apiClient.getMusicSession(this.targetPlayerId, this.targetPlayerName)
        if (session) {
            this.localPlayer.setMusicSession(session)
            this.remotePlayer.setMusicSession(session)
            this.queueManager.setSession(session)
            this.eventEmitter.emit('sessionChanged', session)
        }
    }

    async loadAndPlay() {
        const currentSong = this.queueManager.currentSong
        const uri = currentSong?.web_path || currentSong?.webPath || ''
        if (this.config?.debugAudioContext) {
            this.eventEmitter.emit('log', { nativeOwner: 'CrossAudioControls->loadAndPlay', message: uri })
        }

        if (this.targetPlayerId !== null && this.targetPlayerId !== undefined) {
            await this.queueManager.syncQueue()
        }

        this.player.loadAndPlay(uri)
        this.currentFingerprint = currentSong?.fingerprint || null
    }

    async play(audioFile) {
        if (this.config?.debugAudioContext) {
            this.eventEmitter.emit('log', {
                nativeOwner: 'CrossAudioControls->play',
                message: audioFile?.web_path || audioFile?.webPath || '[empty]'
            })
        }
        if (audioFile) {
            await this.queueManager.addAudioFile(audioFile, true)
        }
        await this.loadAndPlay()
    }

    pause() {
        if (this.config?.debugAudioContext) {
            this.eventEmitter.emit('log', { nativeOwner: 'CrossAudioControls->pause' })
        }
        this.player.pause()
    }

    async resume() {
        if (this.config?.debugAudioContext) {
            this.eventEmitter.emit('log', { nativeOwner: 'CrossAudioControls->resume' })
        }
        const currentSong = this.queueManager.currentSong
        if (this.currentFingerprint === null || this.currentFingerprint !== currentSong?.fingerprint) {
            await this.play(currentSong)
        } else {
            this.player.resume()
        }
    }

    stop() {
        if (this.config?.debugAudioContext) {
            this.eventEmitter.emit('log', { nativeOwner: 'CrossAudioControls->stop' })
        }
        this.player.stop()
    }

    seek(seconds) {
        if (this.config?.debugAudioContext) {
            this.eventEmitter.emit('log', { nativeOwner: 'CrossAudioControls->seek', seconds })
        }
        this.player.seek(seconds)
        this.updateState({ position_seconds: Math.floor(seconds) })
    }

    setVolume(percent) {
        if (this.config?.debugAudioContext) {
            this.eventEmitter.emit('log', { nativeOwner: 'CrossAudioControls->setVolume', percent })
        }
        this.player.setVolume(percent)
        this.updateState({ volume: percent })
    }

    async moveCurrentIndex(amount) {
        this.queueManager.advanceSong(amount)
        await this.play(this.queueManager.currentSong)
    }

    clearQueue() {
        this.stop()
        this.queueManager.clearQueue()
    }

    async shuffleQueue() {
        this.stop()
        await this.queueManager.shuffleQueue()
        await this.play(this.queueManager.currentSong)
    }

    addToQueue(audioFiles) {
        this.queueManager.addAudioFiles(audioFiles)
    }

    async removeFromQueue(audioFiles) {
        await this.queueManager.removeAudioFiles(audioFiles)
        if (this.queueManager.currentSong?.fingerprint !== this.currentFingerprint) {
            this.stop()
            await this.play(this.queueManager.currentSong)
        }
    }

    moveQueueItem(oldIndex, newIndex) {
        this.queueManager.move(oldIndex, newIndex)
    }

    playNext(audioFile) {
        this.queueManager.playNext(audioFile)
    }

    startProgressLoop() {
        if (this.progressTimer) {
            clearInterval(this.progressTimer)
        }

        this.progressTimer = setInterval(async () => {
            try {
                const status = await this.player.getStatus()
                if (!status) return

                const currentSong = this.queueManager.currentSong
                const computed = {
                    position_seconds: status.position_seconds || 0,
                    duration_seconds: Math.floor(currentSong?.duration || status.duration_seconds || 0),
                    is_playing: Boolean(status.is_playing),
                    is_loaded: true,
                    player_state: status.player_state || (status.is_playing ? 'playing' : 'stopped'),
                    queue_fingerprint: status.queue_fingerprint || '',
                    current_song_index: status.current_song_index ?? (this.queueManager.musicSession?.music_queue?.current_song_index ?? 0),
                    volume: status.volume ?? this.playerState.volume
                }

                const hasChanged = !this.lastStatus ||
                    this.lastStatus.position_seconds !== computed.position_seconds ||
                    this.lastStatus.is_playing !== computed.is_playing ||
                    this.lastStatus.current_song_index !== computed.current_song_index ||
                    this.lastStatus.queue_fingerprint !== computed.queue_fingerprint

                if (hasChanged) {
                    if (
                        this.lastStatus &&
                        computed.current_song_index !== this.lastStatus.current_song_index &&
                        computed.queue_fingerprint === this.lastStatus.queue_fingerprint
                    ) {
                        this.queueManager.setCurrentIndex(computed.current_song_index)
                    }

                    if (this.lastStatus && computed.queue_fingerprint !== this.lastStatus.queue_fingerprint) {
                        const session = await this.apiClient.getMusicSession(this.targetPlayerId, this.targetPlayerName)
                        if (session) {
                            this.localPlayer.setMusicSession(session)
                            this.remotePlayer.setMusicSession(session)
                            this.queueManager.setSession(session)
                            this.eventEmitter.emit('sessionChanged', session)
                        }
                    }

                    this.lastStatus = computed
                    this.updateState(computed)
                }
            } catch (exception) {
                if (this.config?.debugAudioContext) {
                    this.eventEmitter.emit('error', {
                        nativeOwner: 'CrossAudioControls->startProgressLoop',
                        message: 'Exception in progress loop',
                        exception: `${exception?.name || 'Error'} - ${exception?.message || String(exception)}`
                    })
                }
            }
        }, 1000)
    }

    cleanup() {
        if (this.progressTimer) {
            clearInterval(this.progressTimer)
            this.progressTimer = null
        }
        if (this.localPlayer) {
            this.localPlayer.cleanup()
        }
        if (this.remotePlayer) {
            this.remotePlayer.cleanup()
        }
    }
}

const Controls = new CrossAudioControls()

export default Controls