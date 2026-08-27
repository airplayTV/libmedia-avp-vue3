<script setup>
import { watch } from 'vue'

defineOptions({ name: 'PlayerSettings' })

const props = defineProps({
  open: { type: Boolean, default: false },
  playbackRate: { type: Number, default: 1 },
  videoTracks: { type: Array, default: () => [] },
  audioTracks: { type: Array, default: () => [] },
  subtitleTracks: { type: Array, default: () => [] }
})

const emit = defineEmits([
  'close', 'refresh', 'rate', 'select-video', 'select-audio', 'select-subtitle'
])
const rates = [0.5, 0.75, 1, 1.25, 1.5, 2]

function trackValue(track, index) {
  return track.index ?? track.id ?? index
}

function trackLabel(track, index) {
  return track.label ?? track.title ?? track.language ?? track.codec ?? `轨道 ${index + 1}`
}

function selectValue(event) {
  const value = event.target.value
  return value !== '' && Number.isFinite(Number(value)) ? Number(value) : value
}

watch(() => props.open, (open) => {
  if (open) emit('refresh')
}, { immediate: true })
</script>

<template>
  <section
    v-if="open"
    class="libmedia-settings"
    role="dialog"
    aria-label="播放设置"
    @click.stop
  >
    <header class="libmedia-settings__header">
      <strong>播放设置</strong>
      <button type="button" class="libmedia-settings__close" aria-label="关闭播放设置" @click="emit('close')">
        关闭
      </button>
    </header>

    <div class="libmedia-settings__group">
      <span class="libmedia-settings__label">播放速度</span>
      <div class="libmedia-settings__rates">
        <button
          v-for="rate in rates"
          :key="rate"
          type="button"
          :aria-pressed="playbackRate === rate"
          @click="emit('rate', rate)"
        >
          {{ rate }}×
        </button>
      </div>
    </div>

    <label class="libmedia-settings__field">
      <span>视频轨道</span>
      <select aria-label="视频轨道" @change="emit('select-video', selectValue($event))">
        <option v-if="videoTracks.length === 0" value="">自动</option>
        <option
          v-for="(track, index) in videoTracks"
          :key="trackValue(track, index)"
          :value="trackValue(track, index)"
        >
          {{ trackLabel(track, index) }}
        </option>
      </select>
    </label>

    <label class="libmedia-settings__field">
      <span>音频轨道</span>
      <select aria-label="音频轨道" @change="emit('select-audio', selectValue($event))">
        <option v-if="audioTracks.length === 0" value="">自动</option>
        <option
          v-for="(track, index) in audioTracks"
          :key="trackValue(track, index)"
          :value="trackValue(track, index)"
        >
          {{ trackLabel(track, index) }}
        </option>
      </select>
    </label>

    <label class="libmedia-settings__field">
      <span>字幕轨道</span>
      <select aria-label="字幕轨道" @change="emit('select-subtitle', selectValue($event))">
        <option :value="-1">关闭</option>
        <option
          v-for="(track, index) in subtitleTracks"
          :key="trackValue(track, index)"
          :value="trackValue(track, index)"
        >
          {{ trackLabel(track, index) }}
        </option>
      </select>
    </label>
  </section>
</template>

