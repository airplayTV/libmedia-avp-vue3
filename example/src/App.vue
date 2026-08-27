<script setup>
import { computed, ref } from 'vue'
import { LibmediaPlayer } from 'libmedia-avp-vue3'

const sources = Object.freeze({
  mp4: '/sample.mp4',
  hls: '/hls/sample.m3u8'
})

const source = ref(sources.mp4)
const sourceInput = ref(sources.mp4)
const state = ref('idle')
const currentTime = ref(0)
const duration = ref(0)
const error = ref(null)

const progress = computed(() => {
  if (!duration.value) return '0%'
  return `${Math.min(100, currentTime.value / duration.value * 100).toFixed(0)}%`
})

function loadSource(nextSource) {
  const normalized = typeof nextSource === 'string' ? nextSource.trim() : nextSource
  if (!normalized) return
  error.value = null
  source.value = normalized
  if (typeof normalized === 'string') sourceInput.value = normalized
}

function loadInput() {
  loadSource(sourceInput.value)
}

function loadLocalFile(event) {
  const file = event.target.files?.[0]
  if (file) loadSource(file)
}

function handleStateChange(payload) {
  state.value = payload.state
}

function handleTimeUpdate(payload) {
  currentTime.value = payload.currentTime
  duration.value = payload.duration
}

function handleReady(payload) {
  duration.value = payload.duration
}

function handleError(payload) {
  error.value = payload
}
</script>

<template>
  <main class="example-shell">
    <header class="masthead">
      <div>
        <p class="eyebrow">libmedia · Vue 3 · JavaScript</p>
        <h1>发布包运行示例</h1>
        <p class="lede">
          页面只通过 npm 包公开入口加载组件、样式和运行时资源。
        </p>
      </div>
      <a href="https://github.com/zhaohappy/libmedia" target="_blank" rel="noreferrer">
        上游项目
      </a>
    </header>

    <section class="player-frame" aria-label="视频播放器演示">
      <LibmediaPlayer
        :src="source"
        wasm-variant="baseline"
        controls
        playsinline
        @ready="handleReady"
        @statechange="handleStateChange"
        @timeupdate="handleTimeUpdate"
        @error="handleError"
      />
    </section>

    <section class="workbench" aria-label="播放源控制台">
      <div class="source-panel">
        <label for="source-url">媒体地址</label>
        <div class="source-row">
          <input
            id="source-url"
            v-model="sourceInput"
            type="url"
            spellcheck="false"
            placeholder="https://example.com/video.m3u8"
            @keydown.enter="loadInput"
          >
          <button type="button" class="primary-action" @click="loadInput">
            加载地址
          </button>
        </div>
        <div class="preset-row">
          <button type="button" @click="loadSource(sources.mp4)">示例 MP4</button>
          <button type="button" @click="loadSource(sources.hls)">示例 HLS</button>
          <label class="file-action">
            打开本地文件
            <input
              type="file"
              accept="video/*,.m3u8,.ts"
              @change="loadLocalFile"
            >
          </label>
        </div>
      </div>

      <aside class="telemetry" aria-label="播放状态">
        <div>
          <span>STATE</span>
          <output data-example-state>{{ state }}</output>
        </div>
        <div>
          <span>TIME</span>
          <output>{{ currentTime.toFixed(2) }} / {{ duration.toFixed(2) }}</output>
        </div>
        <div>
          <span>PROGRESS</span>
          <output>{{ progress }}</output>
        </div>
      </aside>
    </section>

    <p v-if="error" class="error-message" role="alert">
      {{ error.code }}：{{ error.message }}
    </p>
  </main>
</template>
