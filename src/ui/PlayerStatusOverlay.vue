<script setup>
import { computed } from 'vue'
import { PlayerState } from '../core/player-state.js'
import { PauseIcon, PlayIcon, RetryIcon } from './icons.js'

defineOptions({ name: 'PlayerStatusOverlay' })

const props = defineProps({
  state: { type: String, required: true },
  error: { type: Object, default: null },
  poster: { type: String, default: '' },
  busy: { type: Boolean, default: false },
  feedback: { type: String, default: null },
  replay: { type: Boolean, default: false }
})
const emit = defineEmits(['replay', 'play'])
const loading = computed(() => (
  props.busy ||
  props.state === PlayerState.LOADING ||
  props.state === PlayerState.SEEKING
))
const autoplayBlocked = computed(() => props.error?.code === 'AUTOPLAY_BLOCKED')
const activeFeedback = computed(() => loading.value ? 'loading' : props.feedback)
const feedbackLabel = computed(() => ({
  play: '已暂停',
  pause: '正在播放',
  loading: '正在加载'
})[activeFeedback.value] ?? '')
</script>

<template>
  <div class="libmedia-status-overlay">
    <img v-if="poster" class="libmedia-status-overlay__poster" :src="poster" alt="">

    <div
      v-if="error && $slots.error"
      class="libmedia-status-overlay__message"
      aria-live="polite"
    >
      <slot name="error" :error="error">
      </slot>
    </div>

    <button
      v-else-if="autoplayBlocked"
      type="button"
      class="libmedia-status-overlay__center-action"
      aria-label="开始播放"
      @click="emit('play')"
    >
      <PlayIcon />
    </button>

    <button
      v-else-if="replay"
      type="button"
      class="libmedia-status-overlay__center-action"
      aria-label="重播"
      @click="emit('replay')"
    >
      <RetryIcon />
    </button>

    <div
      v-else-if="loading && $slots.loading"
      class="libmedia-status-overlay__message"
      aria-live="polite"
    >
      <slot name="loading" :state="state" />
    </div>

    <div
      v-else-if="activeFeedback"
      class="libmedia-playback-feedback"
      :data-feedback="activeFeedback"
      role="status"
      :aria-label="feedbackLabel"
    >
      <span
        v-if="activeFeedback === 'loading'"
        class="libmedia-status-overlay__spinner"
        aria-hidden="true"
      />
      <PlayIcon v-else-if="activeFeedback === 'play'" />
      <PauseIcon v-else />
      <span class="libmedia-visually-hidden">{{ feedbackLabel }}</span>
    </div>
  </div>
</template>
