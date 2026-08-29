import { flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import LibmediaPlayerCore from '../../src/components/LibmediaPlayerCore.vue'
import { LIBMEDIA_CONTROLLER_FACTORY } from '../../src/composables/use-libmedia-player.js'

class CoreController {
  calls = []
  async load(source) { this.calls.push(['load', source]) }
  async play() { this.calls.push(['play']) }
  async pause() { this.calls.push(['pause']) }
  async stop() { this.calls.push(['stop']) }
  async seek(value) { this.calls.push(['seek', value]) }
  async setVolume(value) { this.calls.push(['setVolume', value]) }
  async mute() { this.calls.push(['mute']) }
  async unmute() { this.calls.push(['unmute']) }
  async enterFullscreen() { this.calls.push(['enterFullscreen']) }
  async exitFullscreen() { this.calls.push(['exitFullscreen']) }
  async resize(width, height) { this.calls.push(['resize', width, height]) }
  getStats() { return { videoCodec: 'h264' } }
  async destroy() { this.calls.push(['destroy']) }
}

function mountCore(props = {}) {
  const controller = new CoreController()
  let factoryOptions
  const wrapper = mount(LibmediaPlayerCore, {
    props: { src: null, ...props },
    global: {
      provide: {
        [LIBMEDIA_CONTROLLER_FACTORY]: async (options) => {
          factoryOptions = options
          return controller
        }
      }
    }
  })
  return { wrapper, controller, factoryOptions: () => factoryOptions }
}

afterEach(() => {
  delete globalThis.ResizeObserver
})

describe('LibmediaPlayerCore', () => {
  it('keeps engine looping disabled and loops only after a natural ended event', async () => {
    const harness = mountCore({ src: 'movie.m3u8', loop: true })
    await flushPromises()

    expect(harness.factoryOptions().engineOptions.loop).toBe(false)

    harness.factoryOptions().onEvent('ended', { state: 'ended' })
    await flushPromises()

    expect(harness.controller.calls).toContainEqual(['seek', 0])
    expect(harness.controller.calls).toContainEqual(['play'])
  })

  it('provides custom-control commands through its default slot', async () => {
    const controller = new CoreController()
    let slotProps
    const wrapper = mount(LibmediaPlayerCore, {
      props: { src: null },
      slots: {
        default: (props) => {
          slotProps = props
          return h('div')
        }
      },
      global: {
        provide: {
          [LIBMEDIA_CONTROLLER_FACTORY]: async () => controller
        }
      }
    })
    await flushPromises()

    expect(slotProps).toMatchObject({
      play: expect.any(Function),
      seek: expect.any(Function),
      setPlaybackRate: expect.any(Function),
      getVideoList: expect.any(Function),
      getAudioList: expect.any(Function),
      getSubtitleList: expect.any(Function),
      selectVideo: expect.any(Function),
      selectAudio: expect.any(Function),
      selectSubtitle: expect.any(Function)
    })

    wrapper.unmount()
  })

  it('exposes the approved component contract and forwards sanitized events', async () => {
    const harness = mountCore({ src: 'movie.mp4', volume: 0.5 })
    await flushPromises()

    expect(harness.wrapper.find('.libmedia-player-core').exists()).toBe(true)
    expect(harness.wrapper.find('.libmedia-player-core__surface').exists()).toBe(true)
    expect(harness.factoryOptions().container).toBe(
      harness.wrapper.get('.libmedia-player-core__surface').element
    )
    expect(harness.wrapper.attributes('tabindex')).toBe('0')
    for (const method of [
      'load', 'play', 'pause', 'stop', 'seek', 'setVolume', 'mute', 'unmute',
      'enterFullscreen', 'exitFullscreen', 'getStats'
    ]) {
      expect(typeof harness.wrapper.vm[method]).toBe('function')
    }

    const publicError = {
      code: 'MEDIA_LOAD_FAILED',
      message: 'Unable to load media',
      recoverable: true,
      requiresUserGesture: false,
      details: {}
    }
    harness.factoryOptions().onEvent('error', publicError)
    expect(harness.wrapper.emitted('error')).toEqual([[publicError]])
    expect(harness.wrapper.emitted('error')[0][0]).not.toHaveProperty('cause')
    expect(harness.wrapper.emitted('error')[0][0]).not.toHaveProperty('source')
  })

  it('keeps instances isolated across source changes and unmount', async () => {
    const first = mountCore({ src: 'a.mp4' })
    const second = mountCore({ src: 'b.mp4' })
    await flushPromises()

    await first.wrapper.setProps({ src: 'a-2.mp4' })
    await flushPromises()

    expect(first.controller.calls.filter(([name]) => name === 'load')).toEqual([
      ['load', 'a.mp4'],
      ['load', 'a-2.mp4']
    ])
    expect(second.controller.calls.filter(([name]) => name === 'load')).toEqual([
      ['load', 'b.mp4']
    ])

    first.wrapper.unmount()
    await flushPromises()
    expect(first.controller.calls.filter(([name]) => name === 'destroy')).toHaveLength(1)
    expect(second.controller.calls.filter(([name]) => name === 'destroy')).toHaveLength(0)

    second.wrapper.unmount()
  })

  it('coalesces repeated dimensions and disconnects ResizeObserver', async () => {
    const observers = []
    globalThis.ResizeObserver = class ResizeObserver {
      constructor(callback) {
        this.callback = callback
        this.disconnected = false
        observers.push(this)
      }
      observe(target) { this.target = target }
      disconnect() { this.disconnected = true }
    }
    const harness = mountCore()
    await flushPromises()
    const observer = observers[0]

    observer.callback([{ contentRect: { width: 640.4, height: 360.4 } }])
    observer.callback([{ contentRect: { width: 640.2, height: 360.2 } }])
    await flushPromises()

    expect(harness.controller.calls.filter(([name]) => name === 'resize')).toEqual([
      ['resize', 640, 360]
    ])

    harness.wrapper.unmount()
    await flushPromises()
    expect(observer.disconnected).toBe(true)
  })
})
