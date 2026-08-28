<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { gsap } from 'gsap'
import { LibmediaPlayer } from 'libmedia-avp-vue3'

const exampleBaseUrl = import.meta.env.BASE_URL
const sources = Object.freeze({
  mp4: `${exampleBaseUrl}sample.mp4`,
  hls: `${exampleBaseUrl}hls/sample.m3u8`
})

const source = ref(sources.mp4)
const sourceInput = ref(sources.mp4)
const state = ref('idle')
const currentTime = ref(0)
const duration = ref(0)
const error = ref(null)
const themeColor = ref('#22c55e')
const cursorAura = ref(null)
let cursorMedia = null

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

onMounted(() => {
  cursorMedia = gsap.matchMedia()
  cursorMedia.add({
    finePointer: '(pointer: fine)',
    reduceMotion: '(prefers-reduced-motion: reduce)'
  }, (context) => {
    const aura = cursorAura.value
    const { finePointer, reduceMotion } = context.conditions
    if (!aura || !finePointer || reduceMotion) return

    gsap.set(aura, { xPercent: -50, yPercent: -50, opacity: 0, scale: 1 })
    const xTo = gsap.quickTo(aura, 'x', { duration: 0.24, ease: 'power3.out' })
    const yTo = gsap.quickTo(aura, 'y', { duration: 0.24, ease: 'power3.out' })
    const interactiveElements = [...document.querySelectorAll(
      'button, a, input, .file-action'
    )].filter((element) => !element.closest('.libmedia-player'))

    const moveAura = (event) => {
      xTo(event.clientX)
      yTo(event.clientY)
      const isOverPlayer = event.target instanceof Element
        && Boolean(event.target.closest('.libmedia-player'))
      gsap.to(aura, {
        opacity: isOverPlayer ? 0 : 0.46,
        duration: isOverPlayer ? 0.12 : 0.18,
        overwrite: 'auto'
      })
    }
    const hideAura = () => {
      gsap.to(aura, { opacity: 0, duration: 0.2, overwrite: 'auto' })
    }
    const tightenAura = () => {
      gsap.to(aura, {
        scale: 0.72,
        opacity: 0.68,
        duration: 0.24,
        ease: 'power2.out',
        overwrite: 'auto'
      })
    }
    const releaseAura = () => {
      gsap.to(aura, {
        scale: 1,
        opacity: 0.46,
        duration: 0.28,
        ease: 'power2.out',
        overwrite: 'auto'
      })
    }

    window.addEventListener('pointermove', moveAura, { passive: true })
    document.documentElement.addEventListener('mouseleave', hideAura)
    for (const element of interactiveElements) {
      element.addEventListener('pointerenter', tightenAura)
      element.addEventListener('pointerleave', releaseAura)
    }

    return () => {
      window.removeEventListener('pointermove', moveAura)
      document.documentElement.removeEventListener('mouseleave', hideAura)
      for (const element of interactiveElements) {
        element.removeEventListener('pointerenter', tightenAura)
        element.removeEventListener('pointerleave', releaseAura)
      }
      xTo.tween.kill()
      yTo.tween.kill()
      gsap.killTweensOf(aura)
    }
  })
})

onBeforeUnmount(() => {
  cursorMedia?.revert()
  cursorMedia = null
})
</script>

<template>
  <div ref="cursorAura" class="cursor-aura" aria-hidden="true" />
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
        :theme-color="themeColor"
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
          <label class="theme-action">
            <span>主题色</span>
            <input v-model="themeColor" type="color" aria-label="播放器主题色">
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
