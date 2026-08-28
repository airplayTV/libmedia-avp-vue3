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
    this.emit('ready', { duration: 120, state: PlayerState.READY, source })
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
  getStats() {
    this.calls.push(['getStats'])
    return {
      videoCodec: 'h264',
      audioCodec: 'aac',
      width: 1920,
      height: 1080,
      fps: 24,
      bitrate: 4_500_000,
      token: 'must-not-render'
    }
  }
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
  delete navigator.clipboard
  delete document.execCommand
  document.body.innerHTML = ''
})

describe('LibmediaPlayer', () => {
  it('keeps the poster dismissed for the active source and restores it for a new source', async () => {
    const harness = mountPlayer({ props: { poster: '/poster.jpg' } })
    await flushPromises()

    expect(harness.wrapper.find('.libmedia-status-overlay__poster').exists()).toBe(true)

    const surface = harness.wrapper.get('.libmedia-player-core__surface')
    await surface.trigger('click')
    await flushPromises()
    expect(harness.wrapper.find('.libmedia-status-overlay__poster').exists()).toBe(false)

    await surface.trigger('click')
    await flushPromises()
    expect(harness.wrapper.find('.libmedia-status-overlay__poster').exists()).toBe(false)

    harness.emit('statechange', {
      state: PlayerState.LOADING,
      previousState: PlayerState.PAUSED
    })
    harness.emit('loading', { state: PlayerState.LOADING, source: 'movie.mp4' })
    await flushPromises()
    expect(harness.wrapper.find('.libmedia-status-overlay__poster').exists()).toBe(false)

    harness.emit('loading', { state: PlayerState.LOADING, source: 'next.mp4' })
    await flushPromises()
    expect(harness.wrapper.find('.libmedia-status-overlay__poster').exists()).toBe(true)
  })

  it('toggles playback when the video surface is clicked', async () => {
    const harness = mountPlayer()
    await flushPromises()

    const surface = harness.wrapper.get('.libmedia-player-core__surface')
    await surface.trigger('click')
    await flushPromises()
    expect(harness.controller().calls.filter(([name]) => name === 'play')).toHaveLength(1)

    await surface.trigger('click')
    await flushPromises()
    expect(harness.controller().calls.filter(([name]) => name === 'pause')).toHaveLength(1)
  })

  it('updates the bottom control and central feedback before play is confirmed', async () => {
    vi.useFakeTimers()
    const harness = mountPlayer()
    await flushPromises()
    const playGate = Promise.withResolvers()
    const controller = harness.controller()
    controller.play = async (options) => {
      controller.calls.push(['play', options])
      await playGate.promise
      controller.emit('statechange', {
        state: PlayerState.PLAYING,
        previousState: PlayerState.READY
      })
      controller.emit('play', { state: PlayerState.PLAYING })
    }

    await harness.wrapper.get('.libmedia-player-core__surface').trigger('click')

    expect(harness.wrapper.get('.libmedia-control-button--primary').attributes('aria-label'))
      .toBe('暂停')
    expect(harness.wrapper.get('.libmedia-playback-feedback').attributes('data-feedback'))
      .toBe('pause')

    await vi.advanceTimersByTimeAsync(600)
    expect(harness.wrapper.find('.libmedia-playback-feedback').exists()).toBe(false)

    playGate.resolve()
    await flushPromises()
  })

  it('shows central play feedback immediately when pausing from the surface', async () => {
    const harness = mountPlayer()
    await flushPromises()
    await harness.wrapper.get('.libmedia-player-core__surface').trigger('click')
    await flushPromises()

    await harness.wrapper.get('.libmedia-player-core__surface').trigger('click')

    expect(harness.wrapper.get('.libmedia-control-button--primary').attributes('aria-label'))
      .toBe('播放')
    expect(harness.wrapper.get('.libmedia-playback-feedback').attributes('data-feedback'))
      .toBe('play')
  })

  it('shows a loading icon when playback stops progressing and clears it on progress', async () => {
    vi.useFakeTimers()
    const harness = mountPlayer()
    await flushPromises()
    await harness.wrapper.get('.libmedia-player-core__surface').trigger('click')
    await flushPromises()

    await vi.advanceTimersByTimeAsync(2000)
    expect(harness.wrapper.get('.libmedia-playback-feedback').attributes('data-feedback'))
      .toBe('loading')

    harness.emit('timeupdate', { currentTime: 1, duration: 120 })
    await flushPromises()

    expect(harness.wrapper.find('[data-feedback="loading"]').exists()).toBe(false)
  })

  it('coalesces a rapid double click to one play followed by one pause', async () => {
    const harness = mountPlayer()
    await flushPromises()
    const playGate = Promise.withResolvers()
    const controller = harness.controller()
    controller.play = async (options) => {
      controller.calls.push(['play', options])
      await playGate.promise
      controller.emit('statechange', {
        state: PlayerState.PLAYING,
        previousState: PlayerState.READY
      })
      controller.emit('play', { state: PlayerState.PLAYING })
    }

    const surface = harness.wrapper.get('.libmedia-player-core__surface')
    await surface.trigger('click')
    await surface.trigger('click')
    expect(controller.calls.filter(([name]) => name === 'play')).toHaveLength(1)

    playGate.resolve()
    await flushPromises()

    expect(controller.calls.filter(([name]) => name === 'play')).toHaveLength(1)
    expect(controller.calls.filter(([name]) => name === 'pause')).toHaveLength(1)
    expect(harness.wrapper.get('.libmedia-player').attributes('data-state')).toBe('paused')
  })

  it('coalesces a rapid triple click to a single play command', async () => {
    const harness = mountPlayer()
    await flushPromises()
    const playGate = Promise.withResolvers()
    const controller = harness.controller()
    controller.play = async (options) => {
      controller.calls.push(['play', options])
      await playGate.promise
      controller.emit('statechange', {
        state: PlayerState.PLAYING,
        previousState: PlayerState.READY
      })
      controller.emit('play', { state: PlayerState.PLAYING })
    }

    const surface = harness.wrapper.get('.libmedia-player-core__surface')
    await surface.trigger('click')
    await surface.trigger('click')
    await surface.trigger('click')
    expect(controller.calls.filter(([name]) => name === 'play')).toHaveLength(1)

    playGate.resolve()
    await flushPromises()

    expect(controller.calls.filter(([name]) => name === 'play')).toHaveLength(1)
    expect(controller.calls.filter(([name]) => name === 'pause')).toHaveLength(0)
    expect(harness.wrapper.get('.libmedia-player').attributes('data-state')).toBe('playing')
  })

  it('does not add built-in surface interactions when controls are disabled', async () => {
    const harness = mountPlayer({ props: { controls: false } })
    await flushPromises()

    const surface = harness.wrapper.get('.libmedia-player-core__surface')
    await surface.trigger('click')
    await surface.trigger('contextmenu', { clientX: 80, clientY: 60 })
    await harness.wrapper.get('.libmedia-player').trigger('keydown', { key: 'k' })
    await flushPromises()

    expect(harness.controller().calls.filter(([name]) => name === 'play')).toHaveLength(0)
    expect(harness.wrapper.find('.libmedia-context-menu').exists()).toBe(false)
  })

  it('reads engine statistics only while the diagnostics panel is open', async () => {
    const harness = mountPlayer()
    await flushPromises()

    expect(harness.controller().calls.filter(([name]) => name === 'getStats')).toHaveLength(0)

    await harness.wrapper.get('.libmedia-player-core__surface').trigger('contextmenu', {
      clientX: 120,
      clientY: 80
    })
    await harness.wrapper.get('.libmedia-context-menu [role="menuitem"]').trigger('click')
    await flushPromises()

    expect(harness.controller().calls.filter(([name]) => name === 'getStats').length).toBeGreaterThan(0)
  })

  it('opens video information from the surface context menu without exposing raw stats', async () => {
    const harness = mountPlayer()
    await flushPromises()

    await harness.wrapper.get('.libmedia-player-core__surface').trigger('contextmenu', {
      clientX: 120,
      clientY: 80
    })
    const menu = harness.wrapper.get('.libmedia-context-menu')
    expect(menu.attributes('role')).toBe('menu')
    expect(menu.findAll('[role="menuitem"]')).toHaveLength(3)

    await menu.findAll('[role="menuitem"]')[0].trigger('click')
    await flushPromises()

    const dialog = harness.wrapper.get('.libmedia-diagnostics')
    expect(dialog.attributes('role')).toBe('dialog')
    expect(dialog.text()).toContain('h264')
    expect(dialog.text()).toContain('1920 × 1080')
    expect(dialog.text()).not.toContain('must-not-render')
  })

  it('separates library details from video information', async () => {
    const harness = mountPlayer()
    await flushPromises()

    await harness.wrapper.get('.libmedia-player-core__surface').trigger('contextmenu', {
      clientX: 120,
      clientY: 80
    })
    const menuItems = harness.wrapper.get('.libmedia-context-menu').findAll('[role="menuitem"]')
    await menuItems[0].trigger('click')
    await flushPromises()

    let dialog = harness.wrapper.get('.libmedia-diagnostics')
    expect(dialog.text()).not.toContain('libmedia-avp-vue3')
    expect(dialog.text()).not.toContain('GitHub 地址')

    await dialog.get('[aria-label="关闭播放诊断"]').trigger('click')
    await harness.wrapper.get('.libmedia-player-core__surface').trigger('contextmenu', {
      clientX: 120,
      clientY: 80
    })
    await harness.wrapper.get('.libmedia-context-menu').findAll('[role="menuitem"]')[2]
      .trigger('click')
    await flushPromises()

    dialog = harness.wrapper.get('.libmedia-diagnostics')
    expect(dialog.get('[role="tab"][aria-selected="true"]').text()).toBe('播放器信息')
    expect(dialog.text()).toContain('libmedia-avp-vue3')
    expect(dialog.text()).toContain('0.1.4')
    const repository = dialog.get('a[href="https://github.com/airplayTV/libmedia-avp-vue3"]')
    expect(repository.attributes('target')).toBe('_blank')
    expect(repository.attributes('rel')).toBe('noopener noreferrer')
  })

  it('shows and copies the complete active URL without masking query parameters', async () => {
    const source = 'https://media.example/video.mp4?token=secret&sign=abc123'
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    })
    const harness = mountPlayer({ props: { src: source } })
    await flushPromises()

    await harness.wrapper.get('.libmedia-player-core__surface').trigger('contextmenu', {
      clientX: 120,
      clientY: 80
    })
    await harness.wrapper.get('.libmedia-context-menu [role="menuitem"]').trigger('click')
    await flushPromises()

    const dialog = harness.wrapper.get('.libmedia-diagnostics')
    expect(dialog.text()).toContain(source)
    await dialog.get('[aria-label="复制当前文件或 URL"]').trigger('click')
    await flushPromises()

    expect(writeText).toHaveBeenCalledWith(source)
    expect(dialog.text()).toContain('已复制')
    expect(dialog.get('[role="status"]').text()).toContain('当前文件或 URL 已复制')
  })

  it('shows the source passed to imperative load instead of the stale src prop', async () => {
    const harness = mountPlayer({ props: { src: 'https://media.example/a.mp4' } })
    await flushPromises()
    const actualSource = 'https://media.example/b.mp4?token=actual'

    await harness.wrapper.vm.load(actualSource)
    await flushPromises()
    await harness.wrapper.get('.libmedia-player-core__surface').trigger('contextmenu', {
      clientX: 120,
      clientY: 80
    })
    await harness.wrapper.get('.libmedia-context-menu [role="menuitem"]').trigger('click')
    await flushPromises()

    const dialog = harness.wrapper.get('.libmedia-diagnostics')
    expect(dialog.text()).toContain(actualSource)
    expect(dialog.text()).not.toContain('https://media.example/a.mp4')
  })

  it('keeps the active source visible during transient loading events', async () => {
    const source = 'https://media.example/movie.mp4?token=active'
    const harness = mountPlayer({ props: { src: source } })
    await flushPromises()

    harness.emit('loading', { state: PlayerState.LOADING, source })
    await harness.wrapper.get('.libmedia-player-core__surface').trigger('contextmenu', {
      clientX: 120,
      clientY: 80
    })
    await harness.wrapper.get('.libmedia-context-menu [role="menuitem"]').trigger('click')
    await flushPromises()

    expect(harness.wrapper.get('.libmedia-diagnostics').text()).toContain(source)
  })

  it('shows local file metadata after imperative loading', async () => {
    const harness = mountPlayer({ props: { src: 'https://media.example/a.mp4' } })
    await flushPromises()
    const file = new File(['video-data'], '本地视频.mp4', { type: 'video/mp4' })

    await harness.wrapper.vm.load(file)
    await flushPromises()
    await harness.wrapper.get('.libmedia-player-core__surface').trigger('contextmenu', {
      clientX: 120,
      clientY: 80
    })
    await harness.wrapper.get('.libmedia-context-menu [role="menuitem"]').trigger('click')
    await flushPromises()

    const dialog = harness.wrapper.get('.libmedia-diagnostics')
    expect(dialog.text()).toContain('本地视频.mp4')
    expect(dialog.text()).toContain('10 B')
    expect(dialog.text()).toContain('video/mp4')
  })

  it('falls back to compatibility copying when Clipboard API rejects', async () => {
    const source = 'https://media.example/video.mp4?token=secret'
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }
    })
    const execCommand = vi.fn().mockReturnValue(true)
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand
    })
    const harness = mountPlayer({ props: { src: source } })
    await flushPromises()

    await harness.wrapper.get('.libmedia-player-core__surface').trigger('contextmenu', {
      clientX: 120,
      clientY: 80
    })
    await harness.wrapper.get('.libmedia-context-menu [role="menuitem"]').trigger('click')
    await flushPromises()
    const dialog = harness.wrapper.get('.libmedia-diagnostics')
    await dialog.get('[aria-label="复制当前文件或 URL"]').trigger('click')
    await flushPromises()

    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(dialog.text()).toContain('已复制')
    expect(dialog.text()).not.toContain('复制失败')
  })

  it('shows manual-copy feedback when compatibility copying returns false', async () => {
    const harness = mountPlayer()
    await flushPromises()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined
    })
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn().mockReturnValue(false)
    })
    await harness.wrapper.get('.libmedia-player-core__surface').trigger('contextmenu', {
      clientX: 120,
      clientY: 80
    })
    await harness.wrapper.get('.libmedia-context-menu [role="menuitem"]').trigger('click')
    await flushPromises()
    const dialog = harness.wrapper.get('.libmedia-diagnostics')

    await dialog.get('[aria-label="复制当前文件或 URL"]').trigger('click')
    await flushPromises()

    expect(dialog.text()).toContain('复制失败，请手动选择')
  })

  it('cleans up and reports failure when compatibility copying throws', async () => {
    const harness = mountPlayer()
    await flushPromises()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined
    })
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn(() => { throw new Error('blocked') })
    })
    await harness.wrapper.get('.libmedia-player-core__surface').trigger('contextmenu', {
      clientX: 120,
      clientY: 80
    })
    await harness.wrapper.get('.libmedia-context-menu [role="menuitem"]').trigger('click')
    await flushPromises()
    const dialog = harness.wrapper.get('.libmedia-diagnostics')

    await dialog.get('[aria-label="复制当前文件或 URL"]').trigger('click')
    await flushPromises()

    expect(dialog.text()).toContain('复制失败，请手动选择')
    expect(document.body.querySelector('textarea')).toBeNull()
  })

  it('coalesces repeated autoplay recovery clicks and clears the error after playing', async () => {
    const harness = mountPlayer()
    await flushPromises()
    const playGate = Promise.withResolvers()
    const controller = harness.controller()
    controller.play = async (options) => {
      controller.calls.push(['play', options])
      await playGate.promise
      controller.emit('statechange', {
        state: PlayerState.PLAYING,
        previousState: PlayerState.READY
      })
      controller.emit('play', { state: PlayerState.PLAYING })
    }
    harness.emit('error', {
      code: 'AUTOPLAY_BLOCKED',
      message: 'Interaction required',
      recoverable: true,
      requiresUserGesture: true,
      details: {}
    })
    await flushPromises()

    const action = harness.wrapper.get('[aria-label="开始播放"]')
    await action.trigger('click')
    await action.trigger('click')
    expect(controller.calls.filter(([name]) => name === 'play')).toHaveLength(1)

    playGate.resolve()
    await flushPromises()

    expect(harness.wrapper.find('[aria-label="开始播放"]').exists()).toBe(false)
  })

  it('closes built-in overlays when controls become disabled at runtime', async () => {
    const harness = mountPlayer()
    await flushPromises()
    await harness.wrapper.get('.libmedia-player-core__surface').trigger('contextmenu', {
      clientX: 120,
      clientY: 80
    })
    await harness.wrapper.get('.libmedia-context-menu [role="menuitem"]').trigger('click')
    await flushPromises()
    expect(harness.wrapper.find('.libmedia-diagnostics').exists()).toBe(true)

    await harness.wrapper.setProps({ controls: false })
    await flushPromises()

    expect(harness.wrapper.find('.libmedia-diagnostics').exists()).toBe(false)
    expect(harness.wrapper.find('.libmedia-context-menu').exists()).toBe(false)
    expect(harness.wrapper.find('.libmedia-settings').exists()).toBe(false)
  })

  it('renders player events and state transitions in clear Chinese', async () => {
    const harness = mountPlayer()
    await flushPromises()

    await harness.wrapper.get('.libmedia-player-core__surface').trigger('contextmenu', {
      clientX: 100,
      clientY: 70
    })
    const menuItems = harness.wrapper.get('.libmedia-context-menu').findAll('[role="menuitem"]')
    await menuItems[1].trigger('click')
    await flushPromises()

    const logs = harness.wrapper.get('.libmedia-diagnostics__logs')
    expect(logs.text()).toContain('开始加载')
    expect(logs.text()).toContain('加载完成')
    expect(logs.text()).toContain('空闲 → 加载中')
    expect(logs.text()).toContain('加载中 → 就绪')
    expect(logs.text()).not.toContain('statechange')
  })

  it('keeps at most 100 safe player log entries', async () => {
    const harness = mountPlayer()
    await flushPromises()

    for (let index = 0; index < 105; index += 1) {
      harness.emit('diagnostic', {
        code: index === 104
          ? 'https://private.example/video.m3u8?token=must-not-render'
          : `DIAGNOSTIC_${index}`,
        message: 'https://private.example/video.m3u8?token=must-not-render'
      })
    }
    await flushPromises()

    await harness.wrapper.get('.libmedia-player-core__surface').trigger('contextmenu', {
      clientX: 100,
      clientY: 70
    })
    const menuItems = harness.wrapper.get('.libmedia-context-menu').findAll('[role="menuitem"]')
    await menuItems[1].trigger('click')
    await flushPromises()

    const entries = harness.wrapper.findAll('.libmedia-diagnostics__log-item')
    expect(entries).toHaveLength(100)
    expect(entries.at(-1).text()).toContain('诊断代码格式异常')
    expect(harness.wrapper.get('.libmedia-diagnostics').text()).not.toContain('private.example')
    expect(harness.wrapper.get('.libmedia-diagnostics').text()).not.toContain('must-not-render')
  })

  it('keeps keyboard focus inside the diagnostics dialog', async () => {
    const harness = mountPlayer()
    document.body.appendChild(harness.wrapper.element)
    await flushPromises()

    await harness.wrapper.get('.libmedia-player-core__surface').trigger('contextmenu', {
      clientX: 120,
      clientY: 80
    })
    await harness.wrapper.get('.libmedia-context-menu [role="menuitem"]').trigger('click')
    await flushPromises()

    const dialog = harness.wrapper.get('.libmedia-diagnostics')
    const focusable = dialog.findAll('button')
    focusable.at(-1).element.focus()
    await dialog.trigger('keydown', { key: 'Tab' })
    expect(document.activeElement).toBe(focusable[0].element)

    focusable[0].element.focus()
    await dialog.trigger('keydown', { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(focusable.at(-1).element)
  })

  it('renders both play states as solid glyphs', async () => {
    const harness = mountPlayer()
    await flushPromises()

    const playIcon = harness.wrapper.get('.libmedia-control-button--primary .libmedia-icon')
    expect(playIcon.classes()).toContain('libmedia-icon--solid')
    expect(playIcon.attributes('fill')).toBe('currentColor')
    expect(playIcon.attributes('stroke')).toBe('none')

    await harness.wrapper.get('.libmedia-control-button--primary').trigger('click')
    await flushPromises()

    const pauseIcon = harness.wrapper.get('.libmedia-control-button--primary .libmedia-icon')
    expect(pauseIcon.classes()).toContain('libmedia-icon--solid')
    expect(pauseIcon.attributes('fill')).toBe('currentColor')
    expect(pauseIcon.attributes('stroke')).toBe('none')
  })

  it('formats short and long playback times with two-digit leading fields', async () => {
    const harness = mountPlayer()
    await flushPromises()

    harness.emit('timeupdate', { currentTime: 369, duration: 5265 })
    await flushPromises()

    expect(harness.wrapper.get('.libmedia-controls__time').text())
      .toBe('06:09 / 01:27:45')
  })

  it('maps the reactive themeColor prop to the public accent variable', async () => {
    const harness = mountPlayer({ props: { themeColor: '#38bdf8' } })
    await flushPromises()

    expect(harness.wrapper.get('.libmedia-player').attributes('style'))
      .toContain('--libmedia-accent: #38bdf8')

    await harness.wrapper.setProps({ themeColor: '#22c55e' })

    expect(harness.wrapper.get('.libmedia-player').attributes('style'))
      .toContain('--libmedia-accent: #22c55e')
  })

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

  it('keeps volume slider keyboard input out of playback seek shortcuts', async () => {
    const harness = mountPlayer()
    await flushPromises()

    await harness.wrapper.get('[role="slider"][aria-label="音量"]')
      .trigger('keydown', { key: 'ArrowRight' })
    await flushPromises()

    const calls = harness.controller().calls
    expect(calls).toContainEqual(['setVolume', 1])
    expect(calls.filter(([name]) => name === 'seek')).toHaveLength(0)
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
