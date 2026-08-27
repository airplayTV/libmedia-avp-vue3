import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LibmediaPlayer from '../../src/components/LibmediaPlayer.vue'
import { LIBMEDIA_CONTROLLER_FACTORY } from '../../src/composables/use-libmedia-player.js'
import { PlayerState } from '../../src/core/player-state.js'

class UiController {
  calls = []

  constructor(emit) {
    this.emit = emit
  }

  async load(source) {
    this.calls.push(['load', source])
    this.emit('statechange', { state: PlayerState.LOADING, previousState: PlayerState.IDLE })
    this.emit('loading', { state: PlayerState.LOADING })
    this.emit('durationchange', { duration: 120 })
    this.emit('statechange', { state: PlayerState.READY, previousState: PlayerState.LOADING })
    this.emit('ready', { duration: 120, state: PlayerState.READY })
  }

  async play(options) {
    this.calls.push(['play', options])
    this.emit('statechange', { state: PlayerState.PLAYING, previousState: PlayerState.READY })
    this.emit('play', { state: PlayerState.PLAYING })
  }

  async pause() {
    this.calls.push(['pause'])
    this.emit('statechange', { state: PlayerState.PAUSED, previousState: PlayerState.PLAYING })
    this.emit('pause', { state: PlayerState.PAUSED })
  }

  async stop() { this.calls.push(['stop']) }
  async seek(value) { this.calls.push(['seek', value]) }
  async setVolume(value) {
    this.calls.push(['setVolume', value])
    this.emit('volumechange', { volume: value, muted: value === 0 })
  }
  async mute() {
    this.calls.push(['mute'])
    this.emit('volumechange', { volume: 0, muted: true })
  }
  async unmute() {
    this.calls.push(['unmute'])
    this.emit('volumechange', { volume: 1, muted: false })
  }
  async setPlaybackRate(value) { this.calls.push(['rate', value]); return value }
  async getVideoList() { this.calls.push(['getVideoList']); return [{ id: 0, label: '1080p' }] }
  async getAudioList() { this.calls.push(['getAudioList']); return [{ id: 1, label: '中文' }] }
  async getSubtitleList() { this.calls.push(['getSubtitleList']); return [{ id: 2, label: '简体中文' }] }
  async selectVideo(id, smooth) { this.calls.push(['selectVideo', id, smooth]) }
  async selectAudio(id, smooth) { this.calls.push(['selectAudio', id, smooth]) }
  async selectSubtitle(id) { this.calls.push(['selectSubtitle', id]) }
  async resize(width, height) { this.calls.push(['resize', width, height]) }
  async enterFullscreen() { this.calls.push(['enterFullscreen']) }
  async exitFullscreen() { this.calls.push(['exitFullscreen']) }
  getStats() { return { videoCodec: 'h264' } }
  async destroy() { this.calls.push(['destroy']) }
}

function mountPlayer(options = {}) {
  let controller
  let emit
  const wrapper = mount(LibmediaPlayer, {
    props: { src: 'movie.mp4', ...options.props },
    slots: options.slots,
    global: {
      provide: {
        [LIBMEDIA_CONTROLLER_FACTORY]: async (factoryOptions) => {
          emit = factoryOptions.onEvent
          controller = new UiController(emit)
          return controller
        }
      }
    }
  })
  return {
    wrapper,
    controller: () => controller,
    emit: (name, payload) => emit(name, payload)
  }
}

afterEach(() => {
  vi.useRealTimers()
  delete globalThis.ResizeObserver
})

describe('LibmediaPlayer', () => {
  it('uses native controls and scopes keyboard shortcuts to the player root', async () => {
    const harness = mountPlayer()
    await flushPromises()

    expect(harness.wrapper.get('[aria-label="播放"]').element.tagName).toBe('BUTTON')
    await harness.wrapper.get('.libmedia-player').trigger('keydown', { key: 'k' })
    await flushPromises()
    expect(harness.controller().calls.filter(([name]) => name === 'play')).toHaveLength(1)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }))
    await flushPromises()
    expect(harness.controller().calls.filter(([name]) => name === 'play')).toHaveLength(1)
  })

  it('falls back to video-only playback when AudioContext is unavailable', async () => {
    const originalAudioContext = globalThis.AudioContext
    const originalWebkitAudioContext = globalThis.webkitAudioContext
    delete globalThis.AudioContext
    delete globalThis.webkitAudioContext
    const harness = mountPlayer()
    await flushPromises()

    await harness.wrapper.get('.libmedia-control-button').trigger('click')
    await flushPromises()

    expect(harness.controller().calls).toContainEqual([
      'play',
      { video: true, audio: false }
    ])
    if (originalAudioContext) globalThis.AudioContext = originalAudioContext
    if (originalWebkitAudioContext) {
      globalThis.webkitAudioContext = originalWebkitAudioContext
    }
  })

  it('hides controls after three idle playing seconds but preserves focused controls', async () => {
    vi.useFakeTimers()
    const harness = mountPlayer()
    await flushPromises()

    await harness.wrapper.get('[aria-label="播放"]').trigger('click')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(2999)
    expect(harness.wrapper.get('.libmedia-player').classes())
      .not.toContain('libmedia-player--controls-hidden')
    await vi.advanceTimersByTimeAsync(1)
    expect(harness.wrapper.get('.libmedia-player').classes())
      .toContain('libmedia-player--controls-hidden')

    await harness.wrapper.get('.libmedia-player').trigger('pointermove')
    await harness.wrapper.get('[aria-label="暂停"]').trigger('focusin')
    await vi.advanceTimersByTimeAsync(3000)
    expect(harness.wrapper.get('.libmedia-player').classes())
      .not.toContain('libmedia-player--controls-hidden')
  })

  it('loads track settings on demand and keeps the panel keyboard accessible', async () => {
    const harness = mountPlayer()
    await flushPromises()

    await harness.wrapper.get('[aria-label="播放设置"]').trigger('click')
    await flushPromises()

    expect(harness.wrapper.get('.libmedia-settings').attributes('role')).toBe('dialog')
    expect(harness.controller().calls).toEqual(expect.arrayContaining([
      ['getVideoList'],
      ['getAudioList'],
      ['getSubtitleList']
    ]))
    expect(harness.wrapper.get('select[aria-label="视频轨道"]').text()).toContain('1080p')
  })

  it('applies reactive volume and muted props to the engine boundary', async () => {
    const harness = mountPlayer()
    await flushPromises()

    await harness.wrapper.setProps({ volume: 0.25, muted: true })
    await flushPromises()

    expect(harness.controller().calls).toEqual(expect.arrayContaining([
      ['setVolume', 0.25],
      ['mute']
    ]))
  })

  it('renders only stable error information and gives autoplay blocking a play action', async () => {
    const harness = mountPlayer()
    await flushPromises()

    harness.emit('error', {
      code: 'MEDIA_LOAD_FAILED',
      message: 'https://private.example/video.m3u8?token=secret',
      source: 'https://private.example/video.m3u8?token=secret',
      cause: { stack: 'secret stack' },
      recoverable: true,
      requiresUserGesture: false,
      details: {}
    })
    await flushPromises()

    expect(harness.wrapper.text()).toContain('MEDIA_LOAD_FAILED')
    expect(harness.wrapper.text()).not.toContain('private.example')
    expect(harness.wrapper.text()).not.toContain('secret stack')

    harness.emit('error', {
      code: 'AUTOPLAY_BLOCKED',
      message: 'Interaction required',
      recoverable: true,
      requiresUserGesture: true,
      details: {}
    })
    await flushPromises()
    expect(harness.wrapper.get('[aria-label="开始播放"]').element.tagName).toBe('BUTTON')
  })

  it('forwards loading, error and controls-extra slots', async () => {
    const harness = mountPlayer({
      slots: {
        loading: '<div class="custom-loading">自定义加载</div>',
        error: '<div class="custom-error">自定义错误</div>',
        'controls-extra': '<button class="custom-control">额外控件</button>'
      }
    })
    await flushPromises()
    expect(harness.wrapper.find('.custom-control').exists()).toBe(true)

    harness.emit('statechange', {
      state: PlayerState.LOADING,
      previousState: PlayerState.READY
    })
    harness.emit('loading', { state: PlayerState.LOADING })
    await flushPromises()
    expect(harness.wrapper.find('.custom-loading').exists()).toBe(true)

    harness.emit('error', {
      code: 'MEDIA_LOAD_FAILED',
      message: 'Failed',
      recoverable: true,
      requiresUserGesture: false,
      details: {}
    })
    await flushPromises()
    expect(harness.wrapper.find('.custom-error').exists()).toBe(true)
  })
})
