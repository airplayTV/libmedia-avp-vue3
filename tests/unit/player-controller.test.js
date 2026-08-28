import { describe, expect, it } from 'vitest'
import { PlayerController } from '../../src/core/player-controller.js'
import { PlayerError } from '../../src/core/player-error.js'
import { PlayerState } from '../../src/core/player-state.js'
import { FakeEngine } from '../helpers/fake-engine.js'

function createHarness(overrides = {}) {
  const engine = overrides.engine ?? new FakeEngine()
  const events = []
  const container = {}
  let engineOptions
  const controller = new PlayerController({
    container,
    engineOptions: { enableWorker: true, container: 'unsafe', getWasm: 'unsafe' },
    loadOptions: {},
    assetResolver: { getWasm: () => '/decoder.wasm' },
    createEngine: (options) => {
      engineOptions = options
      return engine
    },
    onEvent: (name, payload) => events.push([name, payload]),
    ...overrides.options
  })

  return { controller, engine, events, container, getEngineOptions: () => engineOptions }
}

describe('player controller', () => {
  it('creates the engine lazily and converts public seconds at the boundary', async () => {
    const harness = createHarness()

    expect(harness.getEngineOptions()).toBeUndefined()
    await harness.controller.load('a.mp4')
    await harness.controller.seek(1.25)
    await harness.controller.play()

    expect(harness.getEngineOptions()).toMatchObject({
      enableWorker: true,
      container: harness.container,
      getWasm: expect.any(Function)
    })
    expect(harness.engine.calls.slice(0, 3)).toEqual([
      ['load', 'a.mp4', {}],
      ['seek', 1250n],
      ['play', undefined]
    ])
    expect(harness.controller.state).toBe(PlayerState.PLAYING)
    expect(harness.events).toContainEqual([
      'ready',
      { duration: 120, state: PlayerState.READY, source: 'a.mp4' }
    ])
    expect(harness.events).toContainEqual([
      'timeupdate',
      { currentTime: 1.25, duration: 120 }
    ])
  })

  it('rejects an empty source before creating the engine', async () => {
    const harness = createHarness()

    await expect(harness.controller.load('')).rejects.toMatchObject({
      code: 'INVALID_SOURCE'
    })
    expect(harness.getEngineOptions()).toBeUndefined()
  })

  it('retries only recoverable transient load failures', async () => {
    const engine = new FakeEngine()
    const delays = []
    let attempts = 0
    engine.loadImpl = async () => {
      attempts += 1
      if (attempts < 3) {
        throw new PlayerError('MEDIA_TIMEOUT', 'temporary timeout', {
          recoverable: true
        })
      }
    }
    const harness = createHarness({
      engine,
      options: {
        retryPolicy: {
          delays: [500, 1500],
          sleep: async (delay) => delays.push(delay)
        }
      }
    })

    await harness.controller.load('retry.mp4')

    expect(attempts).toBe(3)
    expect(delays).toEqual([500, 1500])

    const unsupportedEngine = new FakeEngine()
    let unsupportedAttempts = 0
    unsupportedEngine.loadImpl = async () => {
      unsupportedAttempts += 1
      throw new PlayerError('CODEC_NOT_INCLUDED', 'decoder missing')
    }
    const unsupportedHarness = createHarness({
      engine: unsupportedEngine,
      options: {
        retryPolicy: {
          delays: [500, 1500],
          sleep: async () => {
            throw new Error('sleep must not be called')
          }
        }
      }
    })

    await expect(unsupportedHarness.controller.load('unsupported.mp4'))
      .rejects.toMatchObject({ code: 'CODEC_NOT_INCLUDED' })
    expect(unsupportedAttempts).toBe(1)
  })

  it('normalizes autoplay blocking without retrying play', async () => {
    const engine = new FakeEngine()
    engine.playImpl = async () => {
      throw new DOMException('Playback requires interaction', 'NotAllowedError')
    }
    const harness = createHarness({ engine })
    await harness.controller.load('movie.mp4')

    await expect(harness.controller.play()).rejects.toMatchObject({
      code: 'AUTOPLAY_BLOCKED',
      recoverable: true,
      requiresUserGesture: true
    })
    expect(engine.calls.filter(([name]) => name === 'play')).toHaveLength(1)
  })

  it('stops the previous source and discards retained events from its epoch', async () => {
    const harness = createHarness()
    await harness.controller.load('a.mp4')
    const oldTimeListener = harness.engine.snapshotListeners('time')[0]

    await harness.controller.load('b.mp4')
    const timeEventsBefore = harness.events.filter(([name]) => name === 'timeupdate')
      .length
    oldTimeListener(99000n)

    expect(harness.events.filter(([name]) => name === 'timeupdate')).toHaveLength(
      timeEventsBefore
    )
    expect(harness.engine.calls).toContainEqual(['stop', true])
    expect(harness.engine.calls.at(-1)).toEqual(['load', 'b.mp4', {}])
    expect(harness.controller.state).toBe(PlayerState.READY)
  })

  it('serializes the complete control, rate, track and render boundary', async () => {
    const harness = createHarness()
    await harness.controller.load('movie.mpd')

    await harness.controller.setVolume(4)
    await harness.controller.mute()
    await harness.controller.unmute()
    await harness.controller.setPlaybackRate(4)
    expect(await harness.controller.getVideoList()).toEqual([
      { id: 0, codec: 'h264' }
    ])
    expect(await harness.controller.getAudioList()).toEqual([
      { id: 1, codec: 'aac' }
    ])
    expect(await harness.controller.getSubtitleList()).toEqual([
      { id: 2, language: 'zh' }
    ])
    await harness.controller.selectVideo(0, true)
    await harness.controller.selectAudio(1, false)
    await harness.controller.selectSubtitle(2)
    await harness.controller.resize(1280, 720)
    await harness.controller.enterFullscreen()
    await harness.controller.exitFullscreen()
    await harness.controller.pause()
    await harness.controller.play()
    await harness.controller.stop()

    expect(harness.engine.calls).toEqual(expect.arrayContaining([
      ['volume', 1],
      ['volume', 0],
      ['volume', 1],
      ['rate', 2],
      ['video', 0, true],
      ['audio', 1, false],
      ['subtitle', 2],
      ['resize', 1280, 720],
      ['enterFullscreen'],
      ['exitFullscreen'],
      ['pause'],
      ['play', undefined],
      ['stop', undefined]
    ]))
    expect(harness.controller.getStats()).toEqual({ videoCodec: 'h264' })
  })

  it('finishes destruction even when engine stop fails and rejects future calls', async () => {
    const engine = new FakeEngine()
    engine.stopImpl = async () => {
      throw new Error('stop failed')
    }
    const harness = createHarness({ engine })
    await harness.controller.load('movie.mp4')

    await harness.controller.destroy()
    await harness.controller.destroy()

    expect(engine.listenerCount()).toBe(0)
    expect(engine.calls).toContainEqual(['destroy'])
    expect(harness.controller.state).toBe(PlayerState.DESTROYED)
    expect(harness.events.filter(([, payload]) => (
      payload?.state === PlayerState.DESTROYED
    ))).toHaveLength(1)
    await expect(harness.controller.play()).rejects.toMatchObject({
      code: 'PLAYER_DESTROYED'
    })
    expect(() => harness.controller.getStats()).toThrowError(
      expect.objectContaining({ code: 'PLAYER_DESTROYED' })
    )
  })
})
