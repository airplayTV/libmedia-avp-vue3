import { defineComponent, nextTick, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import {
  LIBMEDIA_CONTROLLER_FACTORY,
  useLibmediaPlayer
} from '../../src/composables/use-libmedia-player.js'
import { PlayerState } from '../../src/core/player-state.js'

class RecordingController {
  calls = []

  async load(source) { this.calls.push(['load', source]) }
  async play() { this.calls.push(['play']) }
  async pause() { this.calls.push(['pause']) }
  async stop() { this.calls.push(['stop']) }
  async seek(value) { this.calls.push(['seek', value]) }
  async setVolume(value) { this.calls.push(['setVolume', value]) }
  async mute() { this.calls.push(['mute']) }
  async unmute() { this.calls.push(['unmute']) }
  async setPlaybackRate(value) { this.calls.push(['setPlaybackRate', value]); return value }
  async getVideoList() { return [{ id: 0, codec: 'h264' }] }
  async getAudioList() { return [{ id: 1, codec: 'aac' }] }
  async getSubtitleList() { return [{ id: 2, language: 'zh' }] }
  async selectVideo(id, smooth) { this.calls.push(['selectVideo', id, smooth]) }
  async selectAudio(id, smooth) { this.calls.push(['selectAudio', id, smooth]) }
  async selectSubtitle(id) { this.calls.push(['selectSubtitle', id]) }
  async resize(width, height) { this.calls.push(['resize', width, height]) }
  async enterFullscreen() { this.calls.push(['enterFullscreen']) }
  async exitFullscreen() { this.calls.push(['exitFullscreen']) }
  getStats() { return { videoCodec: 'h264' } }
  async destroy() { this.calls.push(['destroy']) }
}

function mountHarness(source) {
  const controller = new RecordingController()
  let result
  let emitControllerEvent
  const factory = async (options) => {
    emitControllerEvent = options.onEvent
    return controller
  }
  const Harness = defineComponent({
    setup() {
      result = useLibmediaPlayer({ src: source })
      return { containerRef: result.containerRef }
    },
    template: '<div ref="containerRef"></div>'
  })
  const wrapper = mount(Harness, {
    global: {
      provide: { [LIBMEDIA_CONTROLLER_FACTORY]: factory }
    }
  })

  return {
    controller,
    result: () => result,
    wrapper,
    emit: (name, payload) => emitControllerEvent(name, payload)
  }
}

describe('useLibmediaPlayer', () => {
  it('returns stable reactive state and the complete command surface', async () => {
    const harness = mountHarness(ref(null))
    await flushPromises()
    const result = harness.result()
    const play = result.play

    expect(result).toMatchObject({
      containerRef: expect.any(Object),
      state: expect.any(Object),
      currentTime: expect.any(Object),
      duration: expect.any(Object),
      volume: expect.any(Object),
      muted: expect.any(Object),
      playbackRate: expect.any(Object),
      videoTracks: expect.any(Object),
      audioTracks: expect.any(Object),
      subtitleTracks: expect.any(Object),
      error: expect.any(Object),
      load: expect.any(Function),
      play: expect.any(Function),
      pause: expect.any(Function),
      seek: expect.any(Function),
      stop: expect.any(Function),
      setPlaybackRate: expect.any(Function),
      getVideoList: expect.any(Function),
      getAudioList: expect.any(Function),
      getSubtitleList: expect.any(Function),
      selectVideo: expect.any(Function),
      selectAudio: expect.any(Function),
      selectSubtitle: expect.any(Function),
      resize: expect.any(Function)
    })

    harness.emit('statechange', {
      state: PlayerState.PLAYING,
      previousState: PlayerState.READY
    })
    harness.emit('timeupdate', { currentTime: 2.5, duration: 120 })
    harness.emit('volumechange', { volume: 0.4, muted: false })

    expect(result.state.value).toBe(PlayerState.PLAYING)
    expect(result.currentTime.value).toBe(2.5)
    expect(result.duration.value).toBe(120)
    expect(result.volume.value).toBe(0.4)
    expect(result.play).toBe(play)

    await result.getVideoList()
    expect(result.videoTracks.value).toEqual([{ id: 0, codec: 'h264' }])
  })

  it('loads the latest source and destroys only its controller on unmount', async () => {
    const source = ref('a.mp4')
    const harness = mountHarness(source)
    await flushPromises()

    expect(harness.controller.calls).toEqual([['load', 'a.mp4']])

    source.value = 'b.mp4'
    await nextTick()
    await flushPromises()
    expect(harness.controller.calls).toEqual([
      ['load', 'a.mp4'],
      ['load', 'b.mp4']
    ])

    harness.wrapper.unmount()
    await flushPromises()
    expect(harness.controller.calls.at(-1)).toEqual(['destroy'])
    expect(harness.controller.calls.filter(([name]) => name === 'destroy')).toHaveLength(1)
  })

  it('forwards sanitized errors into a shallow reactive ref', async () => {
    const harness = mountHarness(ref(null))
    await flushPromises()
    const publicError = {
      code: 'MEDIA_LOAD_FAILED',
      message: 'Unable to load media',
      recoverable: true,
      requiresUserGesture: false,
      details: {}
    }

    harness.emit('error', publicError)

    expect(harness.result().error.value).toBe(publicError)
  })
})
