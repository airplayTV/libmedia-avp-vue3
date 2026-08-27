<script setup>
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  toRef,
  watch
} from 'vue'
import { useLibmediaPlayer } from '../composables/use-libmedia-player.js'

defineOptions({ name: 'LibmediaPlayerCore' })

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
  wasmVariant: {
    type: String,
    default: 'auto',
    validator: (value) => ['auto', 'simd', 'atomic', 'baseline'].includes(value)
  },
  loadOptions: { type: Object, default: () => ({}) },
  engineOptions: { type: Object, default: () => ({}) }
})

const emit = defineEmits([
  'loading',
  'ready',
  'play',
  'pause',
  'timeupdate',
  'durationchange',
  'seeking',
  'seeked',
  'ended',
  'volumechange',
  'statechange',
  'diagnostic',
  'error'
])

const rootRef = ref(null)
const engineOptions = computed(() => ({
  ...props.engineOptions,
  loop: props.loop
}))

let player

function handleControllerEvent(name, payload) {
  emit(name, payload)
  if (name === 'ready' && props.autoplay) {
    void player.play().catch(() => {})
  }
}

player = useLibmediaPlayer({
  src: toRef(props, 'src'),
  volume: props.volume,
  muted: props.muted,
  assetBaseUrl: toRef(props, 'assetBaseUrl'),
  wasmVariant: toRef(props, 'wasmVariant'),
  loadOptions: toRef(props, 'loadOptions'),
  engineOptions,
  onEvent: handleControllerEvent
})

let resizeObserver = null
let lastWidth = -1
let lastHeight = -1

onMounted(() => {
  if (props.volume !== 1) {
    void player.setVolume(props.volume).catch(() => {})
  }
  if (props.muted) {
    void player.mute().catch(() => {})
  }

  if (typeof ResizeObserver === 'function' && rootRef.value) {
    resizeObserver = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (!rect) return

      const width = Math.max(0, Math.round(rect.width))
      const height = Math.max(0, Math.round(rect.height))
      if (width === lastWidth && height === lastHeight) return

      lastWidth = width
      lastHeight = height
      if (width > 0 && height > 0) {
        void player.resize(width, height).catch(() => {})
      }
    })
    resizeObserver.observe(rootRef.value)
  }
})

watch(() => props.volume, (value) => {
  void player.setVolume(value).catch(() => {})
})

watch(() => props.muted, (value) => {
  void (value ? player.mute() : player.unmute()).catch(() => {})
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})

defineExpose({
  load: player.load,
  play: player.play,
  pause: player.pause,
  stop: player.stop,
  seek: player.seek,
  setVolume: player.setVolume,
  mute: player.mute,
  unmute: player.unmute,
  enterFullscreen: player.enterFullscreen,
  exitFullscreen: player.exitFullscreen,
  getStats: player.getStats
})
</script>

<template>
  <div
    ref="rootRef"
    class="libmedia-player-core"
    :data-state="player.state.value"
    tabindex="0"
  >
    <div
      :ref="player.containerRef"
      class="libmedia-player-core__surface"
      aria-hidden="true"
    />
    <slot
      :state="player.state.value"
      :current-time="player.currentTime.value"
      :duration="player.duration.value"
      :volume="player.volume.value"
      :muted="player.muted.value"
      :playback-rate="player.playbackRate.value"
      :video-tracks="player.videoTracks.value"
      :audio-tracks="player.audioTracks.value"
      :subtitle-tracks="player.subtitleTracks.value"
      :error="player.error.value"
      :load="player.load"
      :play="player.play"
      :pause="player.pause"
      :stop="player.stop"
      :seek="player.seek"
      :set-volume="player.setVolume"
      :mute="player.mute"
      :unmute="player.unmute"
      :set-playback-rate="player.setPlaybackRate"
      :get-video-list="player.getVideoList"
      :get-audio-list="player.getAudioList"
      :get-subtitle-list="player.getSubtitleList"
      :select-video="player.selectVideo"
      :select-audio="player.selectAudio"
      :select-subtitle="player.selectSubtitle"
      :enter-fullscreen="player.enterFullscreen"
      :exit-fullscreen="player.exitFullscreen"
    />
  </div>
</template>
