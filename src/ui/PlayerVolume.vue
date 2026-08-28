<script setup>
import { computed, ref } from 'vue'

defineOptions({ name: 'PlayerVolume' })

const props = defineProps({
  value: { type: Number, default: 1 }
})

const emit = defineEmits(['change'])
const dragging = ref(false)

const clamp = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
const normalizedValue = computed(() => clamp(props.value))
const percent = computed(() => Math.round(normalizedValue.value * 100))

function valueFromPointer(event) {
  const rect = event.currentTarget.getBoundingClientRect()
  if (rect.width <= 0) return 0
  return clamp((event.clientX - rect.left) / rect.width)
}

function updateFromPointer(event) {
  emit('change', valueFromPointer(event))
}

function onPointerDown(event) {
  dragging.value = true
  event.currentTarget.setPointerCapture?.(event.pointerId)
  updateFromPointer(event)
}

function onPointerMove(event) {
  if (dragging.value) updateFromPointer(event)
}

function onPointerUp(event) {
  if (!dragging.value) return
  updateFromPointer(event)
  dragging.value = false
  event.currentTarget.releasePointerCapture?.(event.pointerId)
}

function onPointerCancel(event) {
  dragging.value = false
  event.currentTarget.releasePointerCapture?.(event.pointerId)
}

function onKeydown(event) {
  const actions = {
    ArrowLeft: () => clamp(normalizedValue.value - 0.05),
    ArrowDown: () => clamp(normalizedValue.value - 0.05),
    ArrowRight: () => clamp(normalizedValue.value + 0.05),
    ArrowUp: () => clamp(normalizedValue.value + 0.05),
    Home: () => 0,
    End: () => 1
  }
  const action = actions[event.key]
  if (!action) return
  event.preventDefault()
  emit('change', action())
}
</script>

<template>
  <div
    class="libmedia-controls__volume"
    role="slider"
    tabindex="0"
    aria-label="音量"
    aria-valuemin="0"
    :aria-valuenow="percent"
    aria-valuemax="100"
    :aria-valuetext="`${percent}%`"
    :style="{ '--libmedia-volume-value': `${percent}%` }"
    @keydown.stop="onKeydown"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
  >
    <span class="libmedia-volume__track" aria-hidden="true">
      <span class="libmedia-volume__played" />
      <span class="libmedia-volume__thumb" />
    </span>
  </div>
</template>
