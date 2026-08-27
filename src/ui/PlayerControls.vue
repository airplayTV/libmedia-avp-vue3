<script setup>
import { computed, ref } from 'vue'
import { PlayerState } from '../core/player-state.js'
import {
  FullscreenIcon,
  MutedIcon,
  PauseIcon,
  PlayIcon,
  SettingsIcon,
  VolumeIcon
} from './icons.js'
import PlayerProgress from './PlayerProgress.vue'
import PlayerSettings from './PlayerSettings.vue'

defineOptions({ name: 'PlayerControls' })

const props = defineProps({
  state: { type: String, required: true },
  currentTime: { type: Number, default: 0 },
  duration: { type: Number, default: 0 },
  buffered: { type: Number, default: 0 },
  volume: { type: Number, default: 1 },
  muted: { type: Boolean, default: false },
  playbackRate: { type: Number, default: 1 },
  videoTracks: { type: Array, default: () => [] },
  audioTracks: { type: Array, default: () => [] },
  subtitleTracks: { type: Array, default: () => [] },
  settingsOpen: { type: Boolean, default: false }
})

const emit = defineEmits([
  'toggle-play', 'seek', 'volume', 'toggle-mute', 'fullscreen',
  'toggle-settings', 'refresh-tracks', 'rate',
  'select-video', 'select-audio', 'select-subtitle'
])
const previewTime = ref(null)
const playing = computed(() => props.state === PlayerState.PLAYING)

function formatTime(value) {
  const seconds = Math.max(0, Math.floor(value || 0))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor(seconds % 3600 / 60)
  const remainder = seconds % 60
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`
}
</script>

<template>
  <div class="libmedia-controls" @click.stop>
    <PlayerProgress
      :current-time="previewTime ?? currentTime"
      :duration="duration"
      :buffered="buffered"
      @preview="previewTime = $event"
      @seek="previewTime = null; emit('seek', $event)"
    />

    <div class="libmedia-controls__row">
      <button
        type="button"
        class="libmedia-control-button"
        :aria-label="playing ? '暂停' : '播放'"
        @click="emit('toggle-play')"
      >
        <PauseIcon v-if="playing" />
        <PlayIcon v-else />
      </button>

      <span class="libmedia-controls__time" aria-label="播放时间">
        <span>{{ formatTime(previewTime ?? currentTime) }}</span>
        <span class="libmedia-controls__time-total"> / {{ formatTime(duration) }}</span>
      </span>

      <div class="libmedia-controls__spacer" />
      <slot name="extra" />

      <button
        type="button"
        class="libmedia-control-button"
        :aria-label="muted ? '取消静音' : '静音'"
        @click="emit('toggle-mute')"
      >
        <MutedIcon v-if="muted" />
        <VolumeIcon v-else />
      </button>
      <input
        class="libmedia-controls__volume"
        type="range"
        min="0"
        max="1"
        step="0.05"
        :value="muted ? 0 : volume"
        aria-label="音量"
        @input="emit('volume', Number($event.target.value))"
      >

      <button
        type="button"
        class="libmedia-control-button"
        aria-label="播放设置"
        :aria-expanded="settingsOpen"
        @click="emit('toggle-settings')"
      >
        <SettingsIcon />
      </button>

      <button
        type="button"
        class="libmedia-control-button"
        aria-label="进入全屏"
        @click="emit('fullscreen')"
      >
        <FullscreenIcon />
      </button>
    </div>

    <PlayerSettings
      :open="settingsOpen"
      :playback-rate="playbackRate"
      :video-tracks="videoTracks"
      :audio-tracks="audioTracks"
      :subtitle-tracks="subtitleTracks"
      @close="emit('toggle-settings', false)"
      @refresh="emit('refresh-tracks')"
      @rate="emit('rate', $event)"
      @select-video="emit('select-video', $event)"
      @select-audio="emit('select-audio', $event)"
      @select-subtitle="emit('select-subtitle', $event)"
    />
  </div>
</template>

