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
  feedback: { type: String, default: null }
})
const emit = defineEmits(['retry', 'play'])
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

    <div v-if="error" class="libmedia-status-overlay__message" aria-live="polite">
      <slot name="error" :error="error">
        <strong>{{ autoplayBlocked ? '需要手动开始播放' : '播放失败' }}</strong>
        <code>{{ error.code }}</code>
        <button
          v-if="autoplayBlocked"
          type="button"
          class="libmedia-status-overlay__action"
          aria-label="开始播放"
          @click="emit('play')"
        >
          <PlayIcon />
          开始播放
        </button>
        <button
          v-else-if="error.recoverable"
          type="button"
          class="libmedia-status-overlay__action"
          aria-label="重试播放"
          @click="emit('retry')"
        >
          <RetryIcon />
          重试
        </button>
      </slot>
    </div>

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
