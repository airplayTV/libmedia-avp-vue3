<script setup>
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import LibmediaPlayerCore from './LibmediaPlayerCore.vue'
import { PlayerState } from '../core/player-state.js'
import {
  LIBMEDIA_AVP_NAME,
  LIBMEDIA_AVP_REPOSITORY,
  LIBMEDIA_AVP_VERSION
} from '../core/library-info.js'
import PlayerControls from '../ui/PlayerControls.vue'
import PlayerContextMenu from '../ui/PlayerContextMenu.vue'
import PlayerDiagnostics from '../ui/PlayerDiagnostics.vue'
import PlayerStatusOverlay from '../ui/PlayerStatusOverlay.vue'

defineOptions({ name: 'LibmediaPlayer' })

const props = defineProps({
  src: { type: [String, Object], default: null },
  autoplay: { type: Boolean, default: false },
  muted: { type: Boolean, default: false },
  volume: { type: Number, default: 1 },
  loop: { type: Boolean, default: false },
  poster: { type: String, default: '' },
  controls: { type: Boolean, default: true },
  playsinline: { type: Boolean, default: true },
  themeColor: { type: String, default: '' },
  assetBaseUrl: { type: String, default: '' },
  wasmVariant: { type: String, default: 'auto' },
  loadOptions: { type: Object, default: () => ({}) },
  engineOptions: { type: Object, default: () => ({}) }
})

const emit = defineEmits([
  'loading', 'ready', 'play', 'pause', 'timeupdate', 'durationchange',
  'seeking', 'seeked', 'ended', 'volumechange', 'statechange',
  'diagnostic', 'error'
])

const coreRef = ref(null)
const state = ref(PlayerState.IDLE)
const currentTime = ref(0)
const duration = ref(0)
const volume = ref(props.volume)
const muted = ref(props.muted)
const publicError = shallowRef(null)
const controlsVisible = ref(true)
const controlsFocused = ref(false)
const settingsOpen = ref(false)
const contextMenu = ref({ open: false, x: 0, y: 0 })
const diagnosticsOpen = ref(false)
const diagnosticsTab = ref('info')
const playerLogs = ref([])
const activeSource = shallowRef(null)
const posterSource = shallowRef(props.src)
const posterDismissed = ref(false)
const visualPlaying = ref(false)
const playbackFeedback = ref(null)
const streamStalled = ref(false)
let hideTimer = null
let feedbackTimer = null
let stallTimer = null
let desiredPlaying = false
let commandedPlaying = false
let playbackCommandPending = false

const PLAYBACK_FEEDBACK_DURATION = 600
const PLAYBACK_STALL_DELAY = 2000

const surfaceToggleStates = new Set([
  PlayerState.READY,
  PlayerState.PLAYING,
  PlayerState.PAUSED,
  PlayerState.ENDED
])
const loggedEvents = new Set([
  'loading', 'ready', 'play', 'pause', 'seeking', 'seeked', 'ended',
  'statechange', 'diagnostic', 'error'
])
const eventLabels = {
  loading: '开始加载',
  ready: '加载完成',
  play: '开始播放',
  pause: '暂停播放',
  seeking: '开始跳转',
  seeked: '跳转完成',
  ended: '播放结束',
  statechange: '状态变化',
  diagnostic: '播放器诊断',
  error: '播放错误'
}
const stateLabels = {
  [PlayerState.IDLE]: '空闲',
  [PlayerState.LOADING]: '加载中',
  [PlayerState.READY]: '就绪',
  [PlayerState.PLAYING]: '播放中',
  [PlayerState.PAUSED]: '已暂停',
  [PlayerState.SEEKING]: '跳转中',
  [PlayerState.ENDED]: '播放结束',
  [PlayerState.STOPPED]: '已停止',
  [PlayerState.ERROR]: '播放错误',
  [PlayerState.DESTROYED]: '已销毁'
}
const diagnosticCodeLabels = {
  AUTOPLAY_BLOCKED: '浏览器阻止自动播放',
  MEDIA_LOAD_FAILED: '媒体加载失败',
  MEDIA_TIMEOUT: '媒体响应超时',
  RUNTIME_LOAD_FAILED: '播放器运行时加载失败',
  WASM_LOAD_FAILED: '解码组件加载失败',
  SOURCE_STOP_FAILED: '切换播放源时停止失败',
  DESTROY_STOP_FAILED: '销毁播放器时停止失败',
  ENGINE_DESTROY_FAILED: '播放器引擎销毁失败'
}

const themeStyle = computed(() => (
  props.themeColor
    ? { '--libmedia-accent': props.themeColor }
    : undefined
))

const playbackBusy = computed(() => (
  state.value === PlayerState.LOADING ||
  state.value === PlayerState.SEEKING ||
  streamStalled.value
))

function clearHideTimer() {
  if (hideTimer !== null) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

function clearFeedbackTimer() {
  if (feedbackTimer !== null) {
    clearTimeout(feedbackTimer)
    feedbackTimer = null
  }
}

function showPlaybackFeedback(feedback) {
  clearFeedbackTimer()
  playbackFeedback.value = feedback
  feedbackTimer = setTimeout(() => {
    playbackFeedback.value = null
    feedbackTimer = null
  }, PLAYBACK_FEEDBACK_DURATION)
}

function clearStallTimer() {
  if (stallTimer !== null) {
    clearTimeout(stallTimer)
    stallTimer = null
  }
}

function stopStallDetection() {
  clearStallTimer()
  streamStalled.value = false
}

function armStallDetection() {
  clearStallTimer()
  streamStalled.value = false
  if (state.value !== PlayerState.PLAYING || !visualPlaying.value) return
  stallTimer = setTimeout(() => {
    if (state.value === PlayerState.PLAYING && visualPlaying.value) {
      streamStalled.value = true
    }
    stallTimer = null
  }, PLAYBACK_STALL_DELAY)
}

function scheduleHide() {
  clearHideTimer()
  if (
    state.value === PlayerState.PLAYING &&
    !controlsFocused.value &&
    !settingsOpen.value
  ) {
    hideTimer = setTimeout(() => {
      controlsVisible.value = false
      hideTimer = null
    }, 3000)
  }
}

function showControls() {
  controlsVisible.value = true
  scheduleHide()
}

function onFocusIn() {
  controlsFocused.value = true
  controlsVisible.value = true
  clearHideTimer()
}

function onFocusOut(event) {
  if (event.currentTarget.contains(event.relatedTarget)) return
  controlsFocused.value = false
  scheduleHide()
}

function handleEvent(name, payload) {
  appendPlayerLog(name, payload)
  switch (name) {
    case 'loading':
      publicError.value = null
      activeSource.value = null
      if ((payload?.source ?? props.src) !== posterSource.value) {
        posterSource.value = payload?.source ?? props.src
        posterDismissed.value = false
      }
      controlsVisible.value = true
      break
    case 'statechange':
      state.value = payload.state
      syncPlaybackState(payload.state)
      if (payload.state === PlayerState.PLAYING) posterDismissed.value = true
      if (payload.state === PlayerState.PLAYING) armStallDetection()
      else stopStallDetection()
      if (
        payload.state === PlayerState.PLAYING &&
        publicError.value?.code === 'AUTOPLAY_BLOCKED'
      ) {
        publicError.value = null
      }
      if (state.value === PlayerState.PLAYING) scheduleHide()
      else {
        controlsVisible.value = true
        clearHideTimer()
      }
      break
    case 'timeupdate':
      if (
        state.value === PlayerState.PLAYING &&
        Math.abs(payload.currentTime - currentTime.value) >= 0.01
      ) {
        armStallDetection()
      }
      currentTime.value = payload.currentTime
      duration.value = payload.duration
      break
    case 'durationchange':
    case 'ready':
      duration.value = payload.duration
      if (name === 'ready') activeSource.value = payload.source ?? props.src
      break
    case 'volumechange':
      volume.value = payload.volume
      muted.value = payload.muted
      break
    case 'error':
      publicError.value = payload
      controlsVisible.value = true
      clearHideTimer()
      break
  }
  emit(name, payload)
}

function safeLogCode(value) {
  return typeof value === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(value)
    ? value
    : null
}

function logSummary(name, payload) {
  if (name === 'statechange') {
    const previous = stateLabels[payload?.previousState] ?? '未知状态'
    const next = stateLabels[payload?.state] ?? '未知状态'
    return `${previous} → ${next}`
  }
  if (name === 'diagnostic' || name === 'error') {
    const code = safeLogCode(payload?.code)
    if (!code) return '诊断代码格式异常'
    const description = diagnosticCodeLabels[code] ?? (
      name === 'error' ? '未分类播放错误' : '播放器内部诊断'
    )
    return `${description}（${code}）`
  }
  if (name === 'ready') {
    const value = Number(payload?.duration)
    return Number.isFinite(value)
      ? `媒体已就绪，总时长 ${formatDiagnosticTime(value)}`
      : '媒体已就绪'
  }
  const summaries = {
    loading: '正在加载媒体',
    play: '播放器已开始播放',
    pause: '播放器已暂停',
    seeking: '正在跳转播放位置',
    seeked: '播放位置跳转完成',
    ended: '媒体播放完毕'
  }
  return summaries[name] ?? ''
}

function appendPlayerLog(name, payload) {
  if (!loggedEvents.has(name)) return
  const now = new Date()
  const entry = {
    time: now.toLocaleTimeString('zh-CN', { hour12: false }),
    event: eventLabels[name] ?? '播放器事件',
    summary: logSummary(name, payload)
  }
  playerLogs.value = [...playerLogs.value, entry].slice(-100)
}

function run(command) {
  void Promise.resolve(command).catch(() => {})
}

function defaultPlayOptions() {
  const hasAudioContext = (
    typeof globalThis.AudioContext === 'function' ||
    typeof globalThis.webkitAudioContext === 'function'
  )
  return hasAudioContext ? undefined : { video: true, audio: false }
}

const play = (options = defaultPlayOptions()) => coreRef.value?.play(options)

function syncPlaybackState(nextState) {
  if (nextState === PlayerState.PLAYING) commandedPlaying = true
  else if ([
    PlayerState.IDLE,
    PlayerState.LOADING,
    PlayerState.READY,
    PlayerState.PAUSED,
    PlayerState.ENDED,
    PlayerState.STOPPED,
    PlayerState.ERROR,
    PlayerState.DESTROYED
  ].includes(nextState)) commandedPlaying = false
  else return

  if (!playbackCommandPending) {
    desiredPlaying = commandedPlaying
    visualPlaying.value = commandedPlaying
  }
}

async function drainPlaybackIntent() {
  if (playbackCommandPending) return
  playbackCommandPending = true
  try {
    while (desiredPlaying !== commandedPlaying) {
      const targetPlaying = desiredPlaying
      try {
        if (targetPlaying) await play()
        else await coreRef.value?.pause()
        commandedPlaying = targetPlaying
      } catch {
        desiredPlaying = commandedPlaying
        visualPlaying.value = commandedPlaying
        return
      }
    }
  } finally {
    playbackCommandPending = false
    if (desiredPlaying !== commandedPlaying) void drainPlaybackIntent()
  }
}

function requestPlayback(targetPlaying) {
  showControls()
  desiredPlaying = targetPlaying
  visualPlaying.value = targetPlaying
  showPlaybackFeedback(targetPlaying ? 'pause' : 'play')
  if (!targetPlaying) stopStallDetection()
  void drainPlaybackIntent()
}

function togglePlayback() {
  requestPlayback(!desiredPlaying)
}

function isSurfaceEvent(event) {
  return props.controls && event.target instanceof Element && Boolean(
    event.target.closest('.libmedia-player-core__surface')
  )
}

async function closeContextMenu(options = {}) {
  contextMenu.value = { ...contextMenu.value, open: false }
  if (options.restoreFocus) {
    await nextTick()
    coreRef.value?.$el?.focus?.()
  }
}

function handleSurfaceClick(event) {
  if (!isSurfaceEvent(event) || !surfaceToggleStates.has(state.value)) return
  togglePlayback()
}

function handleContextMenu(event) {
  if (!isSurfaceEvent(event)) return
  event.preventDefault()
  const rect = event.currentTarget.getBoundingClientRect()
  contextMenu.value = {
    open: true,
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  }
  controlsVisible.value = true
  clearHideTimer()
}

function openDiagnostics(tab) {
  diagnosticsTab.value = tab
  diagnosticsOpen.value = true
  settingsOpen.value = false
  closeContextMenu()
  controlsVisible.value = true
  clearHideTimer()
}

function closeDiagnostics() {
  diagnosticsOpen.value = false
  coreRef.value?.$el?.focus?.()
  scheduleHide()
}

function statValue(stats, key) {
  const value = stats?.[key]
  return typeof value === 'string' || typeof value === 'number' ? value : '--'
}

function sourceType(source) {
  if (typeof File !== 'undefined' && source instanceof File) return '本地文件'
  if (typeof source !== 'string') return '--'
  const clean = source.split(/[?#]/, 1)[0].toLowerCase()
  if (clean.endsWith('.m3u8')) return 'HLS'
  if (clean.endsWith('.mpd')) return 'DASH'
  const extension = clean.match(/\.([a-z0-9]+)$/)?.[1]
  return extension ? extension.toUpperCase() : '网络媒体'
}

function formatFileSize(size) {
  if (!Number.isFinite(size) || size < 0) return '--'
  if (size < 1024) return `${size} B`
  if (size < 1024 ** 2) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 ** 3) return `${(size / 1024 ** 2).toFixed(1)} MB`
  return `${(size / 1024 ** 3).toFixed(2)} GB`
}

function sourceDetails(source) {
  if (typeof File !== 'undefined' && source instanceof File) {
    return {
      display: `${source.name}（${formatFileSize(source.size)}，${source.type || '未知类型'}）`,
      copyValue: source.name
    }
  }
  if (typeof source === 'string' && source.length > 0) {
    return { display: source, copyValue: source }
  }
  return { display: '--', copyValue: '' }
}

function formatDiagnosticTime(value) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor(seconds % 3600 / 60)
  const remainder = seconds % 60
  const time = [minutes, remainder].map((part) => String(part).padStart(2, '0')).join(':')
  return hours > 0 ? `${String(hours).padStart(2, '0')}:${time}` : time
}

function buildVideoInfo(core) {
  if (!diagnosticsOpen.value) return []
  let stats = null
  try {
    stats = coreRef.value?.getStats?.() ?? null
  } catch {}
  const width = statValue(stats, 'width')
  const height = statValue(stats, 'height')
  const resolution = width !== '--' && height !== '--' ? `${width} × ${height}` : '--'
  const bitrate = statValue(stats, 'bitrate')
  const source = sourceDetails(activeSource.value)

  return [
    { label: '播放器库', value: LIBMEDIA_AVP_NAME },
    { label: '版本号', value: LIBMEDIA_AVP_VERSION },
    {
      label: 'GitHub 地址',
      value: LIBMEDIA_AVP_REPOSITORY,
      href: LIBMEDIA_AVP_REPOSITORY,
      copyable: true,
      copyValue: LIBMEDIA_AVP_REPOSITORY,
      copyLabel: '复制 GitHub 地址'
    },
    {
      label: '当前文件 / URL',
      value: source.display,
      copyable: Boolean(source.copyValue),
      copyValue: source.copyValue,
      copyLabel: '复制当前文件或 URL'
    },
    { label: '播放状态', value: stateLabels[state.value] ?? '未知状态' },
    { label: '媒体类型', value: sourceType(activeSource.value) },
    { label: '播放位置', value: `${formatDiagnosticTime(currentTime.value)} / ${formatDiagnosticTime(duration.value)}` },
    { label: '播放速度', value: `${core.playbackRate}×` },
    { label: '音量', value: muted.value ? '静音' : `${Math.round(volume.value * 100)}%` },
    { label: '视频编码', value: statValue(stats, 'videoCodec') },
    { label: '音频编码', value: statValue(stats, 'audioCodec') },
    { label: '分辨率', value: resolution },
    { label: '帧率', value: statValue(stats, 'fps') },
    { label: '码率', value: bitrate === '--' ? '--' : `${bitrate} bps` },
    { label: '视频轨道', value: core.videoTracks.length },
    { label: '音频轨道', value: core.audioTracks.length },
    { label: '字幕轨道', value: core.subtitleTracks.length }
  ]
}

function seekTo(value) {
  showControls()
  run(coreRef.value?.seek(Math.min(Math.max(0, value), duration.value || 0)))
}

function setVolume(value) {
  showControls()
  run(coreRef.value?.setVolume(Math.min(1, Math.max(0, value))))
}

function toggleMute() {
  showControls()
  run(muted.value ? coreRef.value?.unmute() : coreRef.value?.mute())
}

function setSettingsOpen(value) {
  settingsOpen.value = typeof value === 'boolean' ? value : !settingsOpen.value
  controlsVisible.value = true
  if (settingsOpen.value) clearHideTimer()
  else scheduleHide()
}

watch(() => props.controls, (enabled) => {
  if (enabled) return
  contextMenu.value = { ...contextMenu.value, open: false }
  diagnosticsOpen.value = false
  settingsOpen.value = false
  controlsFocused.value = false
  clearHideTimer()
})

function refreshTracks(core) {
  run(Promise.all([
    core.getVideoList(),
    core.getAudioList(),
    core.getSubtitleList()
  ]))
}

function handleKeydown(event) {
  if (!props.controls) return
  const target = event.target
  const editing = target instanceof Element && target.closest(
    'button, input, select, textarea, [contenteditable="true"]'
  )
  const key = event.key.toLowerCase()
  if (editing && key !== 'escape') return

  const actions = {
    ' ': togglePlayback,
    k: togglePlayback,
    arrowleft: () => seekTo(currentTime.value - 5),
    arrowright: () => seekTo(currentTime.value + 5),
    j: () => seekTo(currentTime.value - 10),
    l: () => seekTo(currentTime.value + 10),
    arrowup: () => setVolume(volume.value + 0.05),
    arrowdown: () => setVolume(volume.value - 0.05),
    m: toggleMute,
    f: () => run(coreRef.value?.enterFullscreen()),
    escape: () => {
      if (settingsOpen.value) setSettingsOpen(false)
      else run(coreRef.value?.exitFullscreen())
    }
  }
  const action = actions[key]
  if (!action) return
  event.preventDefault()
  showControls()
  action()
}

const load = (source = props.src) => coreRef.value?.load(source)
const pause = () => coreRef.value?.pause()
const stop = () => coreRef.value?.stop()
const seek = (seconds) => coreRef.value?.seek(seconds)
const setPublicVolume = (value) => coreRef.value?.setVolume(value)
const mute = () => coreRef.value?.mute()
const unmute = () => coreRef.value?.unmute()
const enterFullscreen = () => coreRef.value?.enterFullscreen()
const exitFullscreen = () => coreRef.value?.exitFullscreen()
const getStats = () => coreRef.value?.getStats() ?? null

defineExpose({
  load,
  play,
  pause,
  stop,
  seek,
  setVolume: setPublicVolume,
  mute,
  unmute,
  enterFullscreen,
  exitFullscreen,
  getStats
})

onBeforeUnmount(() => {
  clearHideTimer()
  clearFeedbackTimer()
  clearStallTimer()
})
</script>

<template>
  <LibmediaPlayerCore
    ref="coreRef"
    v-slot="core"
    class="libmedia-player"
    :class="{
      'libmedia-player--controls-hidden': controls && !controlsVisible,
      'libmedia-player--settings-open': settingsOpen
    }"
    :style="themeStyle"
    :src="src"
    :autoplay="autoplay"
    :muted="props.muted"
    :volume="props.volume"
    :loop="loop"
    :poster="poster"
    :controls="controls"
    :playsinline="playsinline"
    :asset-base-url="assetBaseUrl"
    :wasm-variant="wasmVariant"
    :load-options="loadOptions"
    :engine-options="engineOptions"
    @loading="handleEvent('loading', $event)"
    @ready="handleEvent('ready', $event)"
    @play="handleEvent('play', $event)"
    @pause="handleEvent('pause', $event)"
    @timeupdate="handleEvent('timeupdate', $event)"
    @durationchange="handleEvent('durationchange', $event)"
    @seeking="handleEvent('seeking', $event)"
    @seeked="handleEvent('seeked', $event)"
    @ended="handleEvent('ended', $event)"
    @volumechange="handleEvent('volumechange', $event)"
    @statechange="handleEvent('statechange', $event)"
    @diagnostic="handleEvent('diagnostic', $event)"
    @error="handleEvent('error', $event)"
    @click="handleSurfaceClick"
    @contextmenu="handleContextMenu"
    @keydown="handleKeydown"
    @pointermove="showControls"
    @pointerdown="showControls"
    @touchstart.passive="showControls"
    @focusin="onFocusIn"
    @focusout="onFocusOut"
    @mouseleave="scheduleHide"
  >
    <PlayerStatusOverlay
      :state="state"
      :error="publicError"
      :poster="posterDismissed ? '' : poster"
      :busy="playbackBusy"
      :feedback="controls ? playbackFeedback : null"
      @retry="run(core.load(src))"
      @play="requestPlayback(true)"
    >
      <template v-if="$slots.loading" #loading="slotProps">
        <slot name="loading" v-bind="slotProps" />
      </template>
      <template v-if="$slots.error" #error="slotProps">
        <slot name="error" v-bind="slotProps" />
      </template>
    </PlayerStatusOverlay>

    <PlayerControls
      v-if="controls"
      :state="state"
      :playing="visualPlaying"
      :current-time="core.currentTime"
      :duration="core.duration"
      :buffered="core.currentTime"
      :volume="core.volume"
      :muted="core.muted"
      :playback-rate="core.playbackRate"
      :video-tracks="core.videoTracks"
      :audio-tracks="core.audioTracks"
      :subtitle-tracks="core.subtitleTracks"
      :settings-open="settingsOpen"
      @toggle-play="togglePlayback"
      @seek="seekTo"
      @volume="setVolume"
      @toggle-mute="toggleMute"
      @fullscreen="run(core.enterFullscreen())"
      @toggle-settings="setSettingsOpen"
      @refresh-tracks="refreshTracks(core)"
      @rate="run(core.setPlaybackRate($event))"
      @select-video="run(core.selectVideo($event, true))"
      @select-audio="run(core.selectAudio($event, true))"
      @select-subtitle="run(core.selectSubtitle($event))"
    >
      <template #extra>
        <slot name="controls-extra" :state="state" />
      </template>
    </PlayerControls>

    <PlayerContextMenu
      :open="contextMenu.open"
      :x="contextMenu.x"
      :y="contextMenu.y"
      @close="closeContextMenu"
      @select="openDiagnostics"
    />

    <PlayerDiagnostics
      :open="diagnosticsOpen"
      :tab="diagnosticsTab"
      :info="buildVideoInfo(core)"
      :logs="playerLogs"
      @close="closeDiagnostics"
      @tab="diagnosticsTab = $event"
    />
  </LibmediaPlayerCore>
</template>
