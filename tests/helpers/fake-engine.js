export class FakeEngine {
  calls = []
  listeners = new Map()
  duration = 120000n
  status = 0
  volume = 1
  playbackRate = 1
  loadImpl = null
  playImpl = null
  stopImpl = null

  constructor(options = {}) {
    this.options = options
  }

  on(name, listener) {
    const listeners = this.listeners.get(name) ?? new Set()
    listeners.add(listener)
    this.listeners.set(name, listeners)
    return this
  }

  off(name, listener) {
    this.listeners.get(name)?.delete(listener)
    return this
  }

  emit(name, ...payload) {
    for (const listener of [...(this.listeners.get(name) ?? [])]) {
      listener(...payload)
    }
  }

  snapshotListeners(name) {
    return [...(this.listeners.get(name) ?? [])]
  }

  listenerCount() {
    return [...this.listeners.values()]
      .reduce((count, listeners) => count + listeners.size, 0)
  }

  async load(source, options) {
    this.calls.push(['load', source, options])
    this.emit('loading')
    await this.loadImpl?.(source, options)
    this.emit('loaded')
  }

  async play(options) {
    this.calls.push(['play', options])
    await this.playImpl?.(options)
    this.emit('playing')
  }

  async pause() {
    this.calls.push(['pause'])
    this.emit('paused')
  }

  async seek(value) {
    this.calls.push(['seek', value])
    this.emit('seeking')
    this.emit('time', value)
    this.emit('seeked')
  }

  async stop(noEvent) {
    this.calls.push(['stop', noEvent])
    await this.stopImpl?.(noEvent)
    if (!noEvent) {
      this.emit('stopped')
    }
  }

  setVolume(value) {
    this.volume = value
    this.calls.push(['volume', value])
    this.emit('volumeChange', value)
  }

  getVolume() {
    return this.volume
  }

  setPlaybackRate(value) {
    this.playbackRate = value
    this.calls.push(['rate', value])
  }

  getPlaybackRate() {
    return this.playbackRate
  }

  resize(width, height) {
    this.calls.push(['resize', width, height])
  }

  async getVideoList() {
    this.calls.push(['getVideoList'])
    return [{ id: 0, codec: 'h264' }]
  }

  async getAudioList() {
    this.calls.push(['getAudioList'])
    return [{ id: 1, codec: 'aac' }]
  }

  async getSubtitleList() {
    this.calls.push(['getSubtitleList'])
    return [{ id: 2, language: 'zh' }]
  }

  async selectVideo(id, smooth) {
    this.calls.push(['video', id, smooth])
  }

  async selectAudio(id, smooth) {
    this.calls.push(['audio', id, smooth])
  }

  async selectSubtitle(id) {
    this.calls.push(['subtitle', id])
  }

  enterFullscreen() {
    this.calls.push(['enterFullscreen'])
  }

  exitFullscreen() {
    this.calls.push(['exitFullscreen'])
  }

  getDuration() {
    return this.duration
  }

  getStats() {
    return { videoCodec: 'h264' }
  }

  async destroy() {
    this.calls.push(['destroy'])
  }
}

