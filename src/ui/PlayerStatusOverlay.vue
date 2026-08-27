<script setup>
import { computed } from 'vue'
import { PlayerState } from '../core/player-state.js'
import { PlayIcon, RetryIcon } from './icons.js'

defineOptions({ name: 'PlayerStatusOverlay' })

const props = defineProps({
  state: { type: String, required: true },
  error: { type: Object, default: null },
  poster: { type: String, default: '' }
})
const emit = defineEmits(['retry', 'play'])
const loading = computed(() => props.state === PlayerState.LOADING)
const autoplayBlocked = computed(() => props.error?.code === 'AUTOPLAY_BLOCKED')
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

    <div v-else-if="loading" class="libmedia-status-overlay__message" aria-live="polite">
      <slot name="loading" :state="state">
        <span class="libmedia-status-overlay__spinner" aria-hidden="true" />
        <span>正在准备播放</span>
      </slot>
    </div>
  </div>
</template>
