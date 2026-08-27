<script setup>
import { ref } from 'vue'
import { LibmediaPlayer } from '../../src/index.js'

const MP4_SOURCE = '/sample.mp4'
const HLS_SOURCE = '/hls/sample.m3u8'

const source = ref(MP4_SOURCE)
const mounted = ref(true)
const state = ref('idle')
const currentTime = ref(0)
const errorCode = ref('')

function setSource(nextSource) {
  errorCode.value = ''
  source.value = nextSource
}

function selectLocalFile(event) {
  const file = event.target.files?.[0]
  if (file) setSource(file)
}

function handleStateChange(payload) {
  state.value = payload.state
}

function handleTimeUpdate(payload) {
  currentTime.value = payload.currentTime
}

function handleError(payload) {
  errorCode.value = payload.code
}
</script>

<template>
  <main class="playground-shell">
    <header class="playground-header">
      <div>
        <span class="playground-eyebrow">Vue 3 runtime harness</span>
        <h1>libmedia AVPlayer</h1>
      </div>
      <div class="playground-actions">
        <button type="button" @click="setSource(MP4_SOURCE)">加载 MP4</button>
        <button type="button" @click="setSource(HLS_SOURCE)">加载 HLS</button>
        <label class="playground-file">
          选择本地视频
          <input
            type="file"
            accept="video/*,.m3u8,.ts"
            aria-label="选择本地视频"
            @change="selectLocalFile"
          >
        </label>
        <button type="button" @click="mounted = !mounted">
          {{ mounted ? '卸载播放器' : '挂载播放器' }}
        </button>
      </div>
    </header>

    <section class="playground-stage">
      <LibmediaPlayer
        v-if="mounted"
        :src="source"
        wasm-variant="baseline"
        @statechange="handleStateChange"
        @timeupdate="handleTimeUpdate"
        @error="handleError"
      />
    </section>

    <footer
      class="playground-status"
      :data-player-mounted="String(mounted)"
    >
      <span>状态</span>
      <output :data-player-state="state">{{ state }}</output>
      <span>时间</span>
      <output data-current-time>{{ currentTime.toFixed(2) }}</output>
      <span v-if="errorCode">错误</span>
      <output v-if="errorCode" data-error-code>{{ errorCode }}</output>
    </footer>
  </main>
</template>

<style scoped>
:global(*) { box-sizing: border-box; }
:global(body) {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  color: #f5f7fa;
  background: #07090d;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
}
.playground-shell { width: min(1080px, calc(100% - 32px)); margin: 0 auto; padding: 32px 0; }
.playground-header { display: flex; align-items: end; justify-content: space-between; gap: 24px; margin-bottom: 20px; }
.playground-eyebrow { color: #79e6c6; font: 600 12px/1.2 ui-monospace, monospace; letter-spacing: .12em; text-transform: uppercase; }
h1 { margin: 6px 0 0; font-size: clamp(28px, 4vw, 48px); letter-spacing: -.04em; }
.playground-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
button, .playground-file { min-height: 42px; padding: 0 14px; border: 1px solid #303947; border-radius: 10px; color: inherit; background: #121720; font: inherit; cursor: pointer; }
.playground-file { display: inline-flex; align-items: center; }
.playground-file input { position: absolute; width: 1px; height: 1px; opacity: 0; }
.playground-stage { overflow: hidden; min-height: 360px; border: 1px solid #242b36; border-radius: 18px; background: #000; box-shadow: 0 24px 80px rgb(0 0 0 / .45); }
.playground-stage :deep(.libmedia-player) { min-height: 360px; }
.playground-status { display: grid; grid-template-columns: auto 1fr auto 1fr; gap: 8px 16px; margin-top: 14px; padding: 14px 18px; border-radius: 12px; color: #9aa6b5; background: #10141b; font: 500 13px/1.4 ui-monospace, monospace; }
output { color: #f5f7fa; }
@media (max-width: 760px) {
  .playground-header { align-items: stretch; flex-direction: column; }
  .playground-actions { justify-content: flex-start; }
}
</style>
