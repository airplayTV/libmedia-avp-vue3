<script setup>
import { computed, ref } from 'vue'
import { PlayerState } from '../core/player-state.js'
import {
  ExitFullscreenIcon,
  FullscreenIcon,
  MutedIcon,
  PauseIcon,
  PlayIcon,
  SettingsIcon,
  VolumeIcon
} from './icons.js'
import PlayerProgress from './PlayerProgress.vue'
import PlayerVolume from './PlayerVolume.vue'

defineOptions({ name: 'PlayerControls' })

const props = defineProps({
  state: { type: String, required: true },
  playing: { type: Boolean, default: false },
  currentTime: { type: Number, default: 0 },
  duration: { type: Number, default: 0 },
  buffered: { type: Number, default: 0 },
  volume: { type: Number, default: 1 },
  muted: { type: Boolean, default: false },
  settingsOpen: { type: Boolean, default: false },
  fullscreen: { type: Boolean, default: false }
})

const emit = defineEmits([
  'toggle-play', 'seek', 'volume', 'toggle-mute', 'fullscreen',
  'toggle-settings'
])
const previewTime = ref(null)
const playing = computed(() => props.playing)

function formatTime(value) {
  const seconds = Math.max(0, Math.floor(value || 0))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor(seconds % 3600 / 60)
  const remainder = seconds % 60
  const paddedMinutes = String(minutes).padStart(2, '0')
  const paddedSeconds = String(remainder).padStart(2, '0')
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${paddedMinutes}:${paddedSeconds}`
    : `${paddedMinutes}:${paddedSeconds}`
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
        class="libmedia-control-button libmedia-control-button--primary"
        :aria-label="playing ? '暂停' : '播放'"
        @click="emit('toggle-play')"
      >
        <PauseIcon v-if="playing" />
        <PlayIcon v-else />
      </button>

      <div class="libmedia-controls__volume-group">
        <button
          type="button"
          class="libmedia-control-button"
          :aria-label="muted ? '取消静音' : '静音'"
          @click="emit('toggle-mute')"
        >
          <MutedIcon v-if="muted" />
          <VolumeIcon v-else />
        </button>
        <PlayerVolume
          :value="muted ? 0 : volume"
          @change="emit('volume', $event)"
        />
      </div>

      <span class="libmedia-controls__time" aria-label="播放时间">
        <span>{{ formatTime(previewTime ?? currentTime) }}</span>
        <span class="libmedia-controls__time-total"> / {{ formatTime(duration) }}</span>
      </span>

      <div class="libmedia-controls__spacer" />
      <slot name="extra" />

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
        :aria-label="fullscreen ? '退出全屏' : '进入全屏'"
        @click="emit('fullscreen')"
      >
        <ExitFullscreenIcon v-if="fullscreen" />
        <FullscreenIcon v-else />
      </button>
    </div>
  </div>
</template>
