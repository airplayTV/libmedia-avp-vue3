<script setup>
import { computed, ref } from 'vue'

defineOptions({ name: 'PlayerProgress' })

const props = defineProps({
  currentTime: { type: Number, default: 0 },
  duration: { type: Number, default: 0 },
  buffered: { type: Number, default: 0 }
})

const emit = defineEmits(['preview', 'seek'])
const dragging = ref(false)

const clamp = (value) => Math.min(
  Math.max(0, props.duration || 0),
  Math.max(0, Number.isFinite(value) ? value : 0)
)
const playedPercent = computed(() => (
  props.duration > 0 ? clamp(props.currentTime) / props.duration * 100 : 0
))
const bufferedPercent = computed(() => (
  props.duration > 0 ? clamp(props.buffered) / props.duration * 100 : 0
))

function formatTime(value) {
  const seconds = Math.max(0, Math.floor(value || 0))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor(seconds % 3600 / 60)
  const remainder = seconds % 60
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`
}

function valueFromPointer(event) {
  const rect = event.currentTarget.getBoundingClientRect()
  if (rect.width <= 0) return 0
  return clamp((event.clientX - rect.left) / rect.width * props.duration)
}

function previewPointer(event) {
  const value = valueFromPointer(event)
  emit('preview', value)
  return value
}

function onPointerDown(event) {
  dragging.value = true
  event.currentTarget.setPointerCapture?.(event.pointerId)
  previewPointer(event)
}

function onPointerMove(event) {
  if (dragging.value) previewPointer(event)
}

function onPointerUp(event) {
  if (!dragging.value) return
  const value = previewPointer(event)
  dragging.value = false
  event.currentTarget.releasePointerCapture?.(event.pointerId)
  emit('seek', value)
}

function onPointerCancel(event) {
  dragging.value = false
  event.currentTarget.releasePointerCapture?.(event.pointerId)
}

function onKeydown(event) {
  const actions = {
    ArrowLeft: () => clamp(props.currentTime - 5),
    ArrowRight: () => clamp(props.currentTime + 5),
    Home: () => 0,
    End: () => clamp(props.duration)
  }
  const action = actions[event.key]
  if (!action) return
  event.preventDefault()
  emit('seek', action())
}
</script>

<template>
  <div
    class="libmedia-progress"
    role="slider"
    tabindex="0"
    aria-label="播放进度"
    aria-valuemin="0"
    :aria-valuenow="clamp(currentTime)"
    :aria-valuemax="Math.max(0, duration)"
    :aria-valuetext="`${formatTime(currentTime)} / ${formatTime(duration)}`"
    :style="{
      '--libmedia-progress-played': `${playedPercent}%`,
      '--libmedia-progress-buffered': `${bufferedPercent}%`
    }"
    @keydown="onKeydown"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
  >
    <span class="libmedia-progress__track" aria-hidden="true">
      <span class="libmedia-progress__buffered" />
      <span class="libmedia-progress__played" />
      <span class="libmedia-progress__thumb" />
    </span>
  </div>
</template>
