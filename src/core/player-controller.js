import { OperationQueue } from './operation-queue.js'
import { PlayerError, normalizePlayerError } from './player-error.js'
import { PlayerState, canTransition } from './player-state.js'
import { SourceEpoch } from './source-epoch.js'
import { engineTimeToSeconds, secondsToEngineTime } from './time.js'

const engineEvents = [
  'loading', 'loaded', 'playing', 'paused', 'stopped', 'ended',
  'seeking', 'seeked', 'time', 'error', 'timeout', 'volumeChange'
]

const retryableErrorCodes = new Set([
  'MEDIA_TIMEOUT',
  'MEDIA_LOAD_FAILED',
  'WASM_LOAD_FAILED',
  'RUNTIME_LOAD_FAILED'
])

const defaultSleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay))

function isValidSource(source) {
  if (typeof source === 'string') {
    return source.trim().length > 0
  }
  return typeof File !== 'undefined' && source instanceof File
}

function destroyedError() {
  return new PlayerError('PLAYER_DESTROYED', 'The player has been destroyed')
}

function normalizeCommandError(error, fallback) {
  if (error instanceof PlayerError) {
    return error
  }
  if (error?.name === 'NotAllowedError') {
    return normalizePlayerError(error, {
      code: 'AUTOPLAY_BLOCKED',
      recoverable: true,
      requiresUserGesture: true
    })
  }
  return normalizePlayerError(error, fallback)
}

export class PlayerController {
  #container
  #source
  #engineOptions
  #loadOptions
  #assetResolver
  #createEngine
  #onEvent
  #retryDelays
  #sleep
  #engine = null
  #queue = new OperationQueue()
  #sourceEpoch = new SourceEpoch()
  #listeners = []
  #state = PlayerState.IDLE
  #stateBeforeSeek = PlayerState.READY
  #volume = 1
  #volumeBeforeMute = 1
  #muted = false
  #destroying = false
  #destroyPromise = null

  constructor({
    container,
    source = null,
    engineOptions = {},
    loadOptions = {},
    assetResolver,
    createEngine,
    retryPolicy = {},
    onEvent = () => {}
  }) {
    this.#container = container
    this.#source = source
    this.#engineOptions = { ...engineOptions }
    this.#loadOptions = { ...loadOptions }
    this.#assetResolver = assetResolver
    this.#createEngine = createEngine
    this.#retryDelays = Array.isArray(retryPolicy.delays)
      ? [...retryPolicy.delays]
      : [500, 1500]
    this.#sleep = retryPolicy.sleep ?? defaultSleep
    this.#onEvent = onEvent
  }

  get state() {
    return this.#state
  }

  load(source = this.#source) {
    const unavailable = this.#rejectWhenUnavailable()
    if (unavailable) return unavailable

    if (!isValidSource(source)) {
      return Promise.reject(new PlayerError(
        'INVALID_SOURCE',
        'Player source must be a non-empty URL or File'
      ))
    }

    const replacingSource = this.#sourceEpoch.current > 0
    this.#source = source
    const epoch = this.#sourceEpoch.next()
    this.#queue.clear(
      (operation) => operation.epoch !== epoch,
      new PlayerError('SOURCE_CHANGED', 'Player source changed')
    )

    return this.#queue.enqueue({
      kind: 'load',
      epoch,
      run: async () => {
        if (this.#transition(PlayerState.LOADING)) {
          this.#emit('loading', { state: this.#state })
        }

        const engine = await this.#runWithRetry(
          () => this.#ensureEngine(),
          { code: 'RUNTIME_LOAD_FAILED', recoverable: true, source }
        )

        if (replacingSource) {
          try {
            await engine.stop(true)
          } catch (error) {
            this.#emitDiagnostic('SOURCE_STOP_FAILED', error)
          }
        }

        this.#bindEvents(epoch)
        await this.#runWithRetry(
          () => engine.load(source, { ...this.#loadOptions }),
          { code: 'MEDIA_LOAD_FAILED', recoverable: true, source }
        )

        if (
          this.#sourceEpoch.isCurrent(epoch) &&
          this.#state === PlayerState.LOADING
        ) {
          this.#handleLoaded()
        }
      }
    })
  }

  play(options) {
    return this.#enqueueCurrent('play', async (engine) => {
      try {
        await engine.play(options)
      } catch (error) {
        const normalized = normalizeCommandError(error, {
          code: 'MEDIA_LOAD_FAILED',
          recoverable: true,
          source: this.#source
        })
        this.#reportError(normalized, normalized.code !== 'AUTOPLAY_BLOCKED')
        throw normalized
      }
    })
  }

  pause() {
    return this.#enqueueCurrent('pause', (engine) => engine.pause())
  }

  stop() {
    return this.#enqueueCurrent('stop', (engine) => engine.stop())
  }

  seek(seconds) {
    let engineTime
    try {
      engineTime = secondsToEngineTime(seconds)
    } catch (error) {
      return Promise.reject(error)
    }
    return this.#enqueueCurrent('seek', (engine) => engine.seek(engineTime))
  }

  setVolume(volume) {
    if (!Number.isFinite(volume)) {
      return Promise.reject(new PlayerError(
        'INVALID_VOLUME',
        'Volume must be a finite number'
      ))
    }
    const normalized = Math.min(1, Math.max(0, volume))
    return this.#enqueueCurrent('setVolume', (engine) => {
      this.#volume = normalized
      this.#muted = normalized === 0
      if (normalized > 0) this.#volumeBeforeMute = normalized
      engine.setVolume(normalized)
    })
  }

  mute() {
    return this.#enqueueCurrent('mute', (engine) => {
      if (!this.#muted && this.#volume > 0) {
        this.#volumeBeforeMute = this.#volume
      }
      this.#muted = true
      this.#volume = 0
      engine.setVolume(0)
    })
  }

  unmute() {
    return this.#enqueueCurrent('unmute', (engine) => {
      const volume = Math.min(1, Math.max(0, this.#volumeBeforeMute || 1))
      this.#muted = false
      this.#volume = volume
      engine.setVolume(volume)
    })
  }

  setPlaybackRate(rate) {
    if (!Number.isFinite(rate)) {
      return Promise.reject(new PlayerError(
        'INVALID_PLAYBACK_RATE',
        'Playback rate must be a finite number'
      ))
    }
    const normalized = Math.min(2, Math.max(0.5, rate))
    return this.#enqueueCurrent('setPlaybackRate', (engine) => {
      engine.setPlaybackRate(normalized)
      return normalized
    })
  }

  getVideoList() {
    return this.#enqueueCurrent('getVideoList', (engine) => engine.getVideoList())
  }

  getAudioList() {
    return this.#enqueueCurrent('getAudioList', (engine) => engine.getAudioList())
  }

  getSubtitleList() {
    return this.#enqueueCurrent('getSubtitleList', (engine) => engine.getSubtitleList())
  }

  selectVideo(id, smooth) {
    return this.#enqueueCurrent('selectVideo', (engine) => engine.selectVideo(id, smooth))
  }

  selectAudio(id, smooth) {
    return this.#enqueueCurrent('selectAudio', (engine) => engine.selectAudio(id, smooth))
  }

  selectSubtitle(id) {
    return this.#enqueueCurrent('selectSubtitle', (engine) => engine.selectSubtitle(id))
  }

  resize(width, height) {
    return this.#enqueueCurrent('resize', (engine) => engine.resize(width, height))
  }

  enterFullscreen() {
    return this.#enqueueCurrent('enterFullscreen', (engine) => engine.enterFullscreen())
  }

  exitFullscreen() {
    return this.#enqueueCurrent('exitFullscreen', (engine) => engine.exitFullscreen())
  }

  getStats() {
    if (this.#destroying) throw destroyedError()
    return this.#engine?.getStats() ?? null
  }

  destroy() {
    if (this.#destroyPromise) return this.#destroyPromise

    this.#destroying = true
    const error = destroyedError()
    this.#queue.clear(() => true, error)
    const epoch = this.#sourceEpoch.next()

    this.#destroyPromise = this.#queue.enqueue({
      kind: 'destroy',
      epoch,
      run: async () => {
        if (!this.#engine) return

        try {
          await this.#engine.stop(true)
        } catch (stopError) {
          this.#emitDiagnostic('DESTROY_STOP_FAILED', stopError)
        }

        this.#unbindEvents()

        try {
          await this.#engine.destroy()
        } catch (destroyEngineError) {
          this.#emitDiagnostic('ENGINE_DESTROY_FAILED', destroyEngineError)
        }
      }
    }).finally(() => {
      this.#queue.destroy(error)
      this.#transition(PlayerState.DESTROYED)
    })

    return this.#destroyPromise
  }

  #rejectWhenUnavailable() {
    return this.#destroying ? Promise.reject(destroyedError()) : null
  }

  #enqueueCurrent(kind, run) {
    const unavailable = this.#rejectWhenUnavailable()
    if (unavailable) return unavailable

    const epoch = this.#sourceEpoch.current
    return this.#queue.enqueue({
      kind,
      epoch,
      run: async () => run(await this.#ensureEngine())
    })
  }

  async #runWithRetry(operation, fallback) {
    let retryIndex = 0
    while (true) {
      try {
        return await operation()
      } catch (error) {
        const normalized = normalizeCommandError(error, fallback)
        const canRetry = normalized.recoverable === true &&
          retryableErrorCodes.has(normalized.code) &&
          retryIndex < this.#retryDelays.length &&
          !this.#destroying

        if (!canRetry) {
          this.#reportError(normalized)
          throw normalized
        }

        const delay = this.#retryDelays[retryIndex]
        retryIndex += 1
        await this.#sleep(delay)
      }
    }
  }

  async #ensureEngine() {
    if (this.#engine) return this.#engine
    if (typeof this.#createEngine !== 'function') {
      throw new PlayerError(
        'RUNTIME_LOAD_FAILED',
        'No AVPlayer engine factory was configured'
      )
    }

    const engine = await this.#createEngine({
      ...this.#engineOptions,
      container: this.#container,
      getWasm: (type, codecId, mediaType) => (
        this.#assetResolver?.getWasm(type, codecId, mediaType)
      )
    })
    if (!engine || typeof engine.load !== 'function') {
      throw new PlayerError(
        'RUNTIME_LOAD_FAILED',
        'AVPlayer engine factory returned an invalid engine'
      )
    }
    this.#engine = engine
    return engine
  }

  #bindEvents(epoch) {
    this.#unbindEvents()
    for (const name of engineEvents) {
      const listener = (...payload) => {
        if (this.#sourceEpoch.isCurrent(epoch) && !this.#destroying) {
          this.#handleEngineEvent(name, payload)
        }
      }
      this.#engine.on(name, listener)
      this.#listeners.push([name, listener])
    }
  }

  #unbindEvents() {
    if (!this.#engine) {
      this.#listeners = []
      return
    }
    for (const [name, listener] of this.#listeners) {
      this.#engine.off(name, listener)
    }
    this.#listeners = []
  }

  #handleEngineEvent(name, payload) {
    switch (name) {
      case 'loading':
        if (this.#transition(PlayerState.LOADING)) {
          this.#emit('loading', { state: this.#state })
        }
        break
      case 'loaded':
        this.#handleLoaded()
        break
      case 'playing':
        if (this.#transition(PlayerState.PLAYING)) {
          this.#emit('play', { state: this.#state })
        }
        break
      case 'paused':
        if (this.#transition(PlayerState.PAUSED)) {
          this.#emit('pause', { state: this.#state })
        }
        break
      case 'stopped':
        this.#transition(PlayerState.STOPPED)
        break
      case 'ended':
        if (this.#transition(PlayerState.ENDED)) {
          this.#emit('ended', { state: this.#state })
        }
        break
      case 'seeking':
        this.#stateBeforeSeek = this.#state
        if (this.#transition(PlayerState.SEEKING)) {
          this.#emit('seeking', { state: this.#state })
        }
        break
      case 'seeked':
        if (this.#transition(this.#stateBeforeSeek)) {
          this.#emit('seeked', { state: this.#state })
        }
        break
      case 'time':
        this.#emit('timeupdate', {
          currentTime: engineTimeToSeconds(payload[0]),
          duration: this.#getDuration()
        })
        break
      case 'volumeChange':
        this.#volume = Math.min(1, Math.max(0, payload[0]))
        this.#muted = this.#volume === 0
        this.#emit('volumechange', {
          volume: this.#volume,
          muted: this.#muted
        })
        break
      case 'timeout':
        this.#reportError(new PlayerError(
          'MEDIA_TIMEOUT',
          'Media operation timed out',
          { recoverable: true, source: this.#source }
        ))
        break
      case 'error':
        this.#reportError(normalizeCommandError(payload[0], {
          code: 'MEDIA_LOAD_FAILED',
          recoverable: true,
          source: this.#source
        }))
        break
    }
  }

  #handleLoaded() {
    if (!this.#transition(PlayerState.READY)) return
    const duration = this.#getDuration()
    this.#emit('durationchange', { duration })
    this.#emit('ready', { duration, state: this.#state })
  }

  #getDuration() {
    return this.#engine ? engineTimeToSeconds(this.#engine.getDuration()) : 0
  }

  #reportError(error, transition = true) {
    if (transition) this.#transition(PlayerState.ERROR)
    this.#emit('error', error.toPublicJSON())
  }

  #emitDiagnostic(code, error) {
    this.#emit('diagnostic', {
      code,
      message: error?.message ?? 'Unknown engine cleanup failure'
    })
  }

  #transition(nextState) {
    if (!canTransition(this.#state, nextState)) return false
    const previousState = this.#state
    if (previousState === nextState) return false
    this.#state = nextState
    this.#emit('statechange', { state: nextState, previousState })
    return true
  }

  #emit(name, payload) {
    try {
      this.#onEvent(name, payload)
    } catch {
      // Consumer event handlers cannot interrupt player lifecycle operations.
    }
  }
}
