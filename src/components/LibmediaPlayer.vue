<script setup>
import { onBeforeUnmount, ref, shallowRef } from 'vue'
import LibmediaPlayerCore from './LibmediaPlayerCore.vue'
import { PlayerState } from '../core/player-state.js'
import PlayerControls from '../ui/PlayerControls.vue'
import PlayerStatusOverlay from '../ui/PlayerStatusOverlay.vue'

defineOptions({ name: 'LibmediaPlayer' })

const props = defineProps({
  src: { type: [String, Object], default: null },
  autoplay: { type: Boolean, default: false },
  muted: { type: Boolean, default: false },
  volume: { type: Number, default: 1 },
  loop: { type: Boolean, default: false },
  poster: { type: String, default: '' },
  controls: { type: Boolean, default: true },
  playsinline: { type: Boolean, default: true },
  assetBaseUrl: { type: String, default: '' },
  wasmVariant: { type: String, default: 'auto' },
  loadOptions: { type: Object, default: () => ({}) },
  engineOptions: { type: Object, default: () => ({}) }
})

const emit = defineEmits([
  'loading', 'ready', 'play', 'pause', 'timeupdate', 'durationchange',
  'seeking', 'seeked', 'ended', 'volumechange', 'statechange',
  'diagnostic', 'error'
])

const coreRef = ref(null)
const state = ref(PlayerState.IDLE)
const currentTime = ref(0)
const duration = ref(0)
const volume = ref(props.volume)
const muted = ref(props.muted)
const publicError = shallowRef(null)
const controlsVisible = ref(true)
const controlsFocused = ref(false)
const settingsOpen = ref(false)
let hideTimer = null

function clearHideTimer() {
  if (hideTimer !== null) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

function scheduleHide() {
  clearHideTimer()
  if (
    state.value === PlayerState.PLAYING &&
    !controlsFocused.value &&
    !settingsOpen.value
  ) {
    hideTimer = setTimeout(() => {
      controlsVisible.value = false
      hideTimer = null
    }, 3000)
  }
}

function showControls() {
  controlsVisible.value = true
  scheduleHide()
}

function onFocusIn() {
  controlsFocused.value = true
  controlsVisible.value = true
  clearHideTimer()
}

function onFocusOut(event) {
  if (event.currentTarget.contains(event.relatedTarget)) return
  controlsFocused.value = false
  scheduleHide()
}

function handleEvent(name, payload) {
  switch (name) {
    case 'loading':
      publicError.value = null
      controlsVisible.value = true
      break
    case 'statechange':
      state.value = payload.state
      if (state.value === PlayerState.PLAYING) scheduleHide()
      else {
        controlsVisible.value = true
        clearHideTimer()
      }
      break
    case 'timeupdate':
      currentTime.value = payload.currentTime
      duration.value = payload.duration
      break
    case 'durationchange':
    case 'ready':
      duration.value = payload.duration
      break
    case 'volumechange':
      volume.value = payload.volume
      muted.value = payload.muted
      break
    case 'error':
      publicError.value = payload
      controlsVisible.value = true
      clearHideTimer()
      break
  }
  emit(name, payload)
}

function run(command) {
  void Promise.resolve(command).catch(() => {})
}

function defaultPlayOptions() {
  const hasAudioContext = (
    typeof globalThis.AudioContext === 'function' ||
    typeof globalThis.webkitAudioContext === 'function'
  )
  return hasAudioContext ? undefined : { video: true, audio: false }
}

const play = (options = defaultPlayOptions()) => coreRef.value?.play(options)

function togglePlayback() {
  showControls()
  run(state.value === PlayerState.PLAYING
    ? coreRef.value?.pause()
    : play())
}

function seekTo(value) {
  showControls()
  run(coreRef.value?.seek(Math.min(Math.max(0, value), duration.value || 0)))
}

function setVolume(value) {
  showControls()
  run(coreRef.value?.setVolume(Math.min(1, Math.max(0, value))))
}

function toggleMute() {
  showControls()
  run(muted.value ? coreRef.value?.unmute() : coreRef.value?.mute())
}

function setSettingsOpen(value) {
  settingsOpen.value = typeof value === 'boolean' ? value : !settingsOpen.value
  controlsVisible.value = true
  if (settingsOpen.value) clearHideTimer()
  else scheduleHide()
}

function refreshTracks(core) {
  run(Promise.all([
    core.getVideoList(),
    core.getAudioList(),
    core.getSubtitleList()
  ]))
}

function handleKeydown(event) {
  const target = event.target
  const editing = target instanceof Element && target.closest(
    'button, input, select, textarea, [contenteditable="true"]'
  )
  const key = event.key.toLowerCase()
  if (editing && key !== 'escape') return

  const actions = {
    ' ': togglePlayback,
    k: togglePlayback,
    arrowleft: () => seekTo(currentTime.value - 5),
    arrowright: () => seekTo(currentTime.value + 5),
    j: () => seekTo(currentTime.value - 10),
    l: () => seekTo(currentTime.value + 10),
    arrowup: () => setVolume(volume.value + 0.05),
    arrowdown: () => setVolume(volume.value - 0.05),
    m: toggleMute,
    f: () => run(coreRef.value?.enterFullscreen()),
    escape: () => {
      if (settingsOpen.value) setSettingsOpen(false)
      else run(coreRef.value?.exitFullscreen())
    }
  }
  const action = actions[key]
  if (!action) return
  event.preventDefault()
  showControls()
  action()
}

const load = (source = props.src) => coreRef.value?.load(source)
const pause = () => coreRef.value?.pause()
const stop = () => coreRef.value?.stop()
const seek = (seconds) => coreRef.value?.seek(seconds)
const setPublicVolume = (value) => coreRef.value?.setVolume(value)
const mute = () => coreRef.value?.mute()
const unmute = () => coreRef.value?.unmute()
const enterFullscreen = () => coreRef.value?.enterFullscreen()
const exitFullscreen = () => coreRef.value?.exitFullscreen()
const getStats = () => coreRef.value?.getStats() ?? null

defineExpose({
  load,
  play,
  pause,
  stop,
  seek,
  setVolume: setPublicVolume,
  mute,
  unmute,
  enterFullscreen,
  exitFullscreen,
  getStats
})

onBeforeUnmount(clearHideTimer)
</script>

<template>
  <LibmediaPlayerCore
    ref="coreRef"
    v-slot="core"
    class="libmedia-player"
    :class="{
      'libmedia-player--controls-hidden': controls && !controlsVisible,
      'libmedia-player--settings-open': settingsOpen
    }"
    :src="src"
    :autoplay="autoplay"
    :muted="props.muted"
    :volume="props.volume"
    :loop="loop"
    :poster="poster"
    :controls="controls"
    :playsinline="playsinline"
    :asset-base-url="assetBaseUrl"
    :wasm-variant="wasmVariant"
    :load-options="loadOptions"
    :engine-options="engineOptions"
    @loading="handleEvent('loading', $event)"
    @ready="handleEvent('ready', $event)"
    @play="handleEvent('play', $event)"
    @pause="handleEvent('pause', $event)"
    @timeupdate="handleEvent('timeupdate', $event)"
    @durationchange="handleEvent('durationchange', $event)"
    @seeking="handleEvent('seeking', $event)"
    @seeked="handleEvent('seeked', $event)"
    @ended="handleEvent('ended', $event)"
    @volumechange="handleEvent('volumechange', $event)"
    @statechange="handleEvent('statechange', $event)"
    @diagnostic="handleEvent('diagnostic', $event)"
    @error="handleEvent('error', $event)"
    @keydown="handleKeydown"
    @pointermove="showControls"
    @pointerdown="showControls"
    @touchstart.passive="showControls"
    @focusin="onFocusIn"
    @focusout="onFocusOut"
    @mouseleave="scheduleHide"
  >
    <PlayerStatusOverlay
      :state="state"
      :error="publicError"
      :poster="poster"
      @retry="run(core.load(src))"
      @play="run(play())"
    >
      <template v-if="$slots.loading" #loading="slotProps">
        <slot name="loading" v-bind="slotProps" />
      </template>
      <template v-if="$slots.error" #error="slotProps">
        <slot name="error" v-bind="slotProps" />
      </template>
    </PlayerStatusOverlay>

    <PlayerControls
      v-if="controls"
      :state="state"
      :current-time="core.currentTime"
      :duration="core.duration"
      :buffered="core.currentTime"
      :volume="core.volume"
      :muted="core.muted"
      :playback-rate="core.playbackRate"
      :video-tracks="core.videoTracks"
      :audio-tracks="core.audioTracks"
      :subtitle-tracks="core.subtitleTracks"
      :settings-open="settingsOpen"
      @toggle-play="togglePlayback"
      @seek="seekTo"
      @volume="setVolume"
      @toggle-mute="toggleMute"
      @fullscreen="run(core.enterFullscreen())"
      @toggle-settings="setSettingsOpen"
      @refresh-tracks="refreshTracks(core)"
      @rate="run(core.setPlaybackRate($event))"
      @select-video="run(core.selectVideo($event, true))"
      @select-audio="run(core.selectAudio($event, true))"
      @select-subtitle="run(core.selectSubtitle($event))"
    >
      <template #extra>
        <slot name="controls-extra" :state="state" />
      </template>
    </PlayerControls>
  </LibmediaPlayerCore>
</template>
