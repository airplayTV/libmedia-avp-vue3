<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  useAttrs,
  watch
} from 'vue'
import LibmediaPlayerCore from './LibmediaPlayerCore.vue'
import { PlayerState } from '../core/player-state.js'
import {
  LIBMEDIA_AVPLAYER_VERSION,
  LIBMEDIA_AVP_NAME,
  LIBMEDIA_AVP_REPOSITORY,
  LIBMEDIA_AVP_VERSION
} from '../core/library-info.js'
import PlayerControls from '../ui/PlayerControls.vue'
import PlayerContextMenu from '../ui/PlayerContextMenu.vue'
import PlayerDiagnostics from '../ui/PlayerDiagnostics.vue'
import PlayerSettings from '../ui/PlayerSettings.vue'
import PlayerStatusOverlay from '../ui/PlayerStatusOverlay.vue'
import { CloseIcon, PauseIcon, PlayIcon, RestoreIcon } from '../ui/icons.js'

defineOptions({ name: 'LibmediaPlayer', inheritAttrs: false })

const attrs = useAttrs()

const props = defineProps({
  src: { type: [String, Object], default: null },
  autoplay: { type: Boolean, default: false },
  muted: { type: Boolean, default: false },
  volume: { type: Number, default: 1 },
  loop: { type: Boolean, default: false },
  poster: { type: String, default: '' },
  controls: { type: Boolean, default: true },
  playsinline: { type: Boolean, default: true },
  miniMode: { type: Boolean, default: false },
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
const fullscreenMode = ref(null)
const fullscreenDesired = ref(false)
const replayVisible = ref(false)
const errorNotice = ref(null)
const miniAnchorRef = ref(null)
const miniActive = ref(false)
const miniDismissed = ref(false)
const miniSourceVisible = ref(true)
const miniAnchorStyle = ref(undefined)
let hideTimer = null
let feedbackTimer = null
let stallTimer = null
let errorNoticeTimer = null
let desiredPlaying = false
let commandedPlaying = false
let playbackCommandPending = false
let lastInteractionWasKeyboard = false
let revealOnlySurfaceClick = false
let runtimeRecoveryContext = null
let failedPlaybackContext = null
let recoveryPromise = null
let recoverySource = null
let recoveryEpoch = 0
let sourceGeneration = 0
let autoRecoveryBudget = { source: null, time: 0, attempts: 0 }
let bodyOverflowBeforeFullscreen = null
let fullscreenEpoch = 0
let miniObserver = null
let disposed = false

const PLAYBACK_FEEDBACK_DURATION = 600
const PLAYBACK_STALL_DELAY = 2000
const CONTROLS_HIDE_DELAY = 5000
const AUTO_RECOVERY_POSITION_WINDOW = 3
const AUTO_RECOVERY_RESET_PROGRESS = 5

const surfaceToggleStates = new Set([
  PlayerState.READY,
  PlayerState.PLAYING,
  PlayerState.PAUSED,
  PlayerState.ENDED
])

const controlsAutoHideStates = new Set([
  PlayerState.PLAYING,
  PlayerState.PAUSED
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
const fullscreen = computed(() => (
  fullscreenMode.value !== null || fullscreenDesired.value
))

function observeMiniTarget(target) {
  miniObserver?.disconnect()
  if (target) miniObserver?.observe(target)
}

async function enterMiniMode() {
  if (
    miniActive.value ||
    !props.miniMode ||
    miniDismissed.value ||
    state.value !== PlayerState.PLAYING ||
    fullscreen.value
  ) return

  const player = playerElement()
  if (!player) return
  const rect = player.getBoundingClientRect()
  miniAnchorStyle.value = {
    width: `${rect.width}px`,
    height: `${rect.height}px`
  }
  miniActive.value = true
  await nextTick()
  observeMiniTarget(miniAnchorRef.value)
}

async function exitMiniMode() {
  if (!miniActive.value) return
  miniActive.value = false
  await nextTick()
  miniAnchorStyle.value = undefined
  observeMiniTarget(playerElement())
}

function dismissMiniMode() {
  miniDismissed.value = true
  void exitMiniMode()
}

function restoreMiniMode() {
  miniDismissed.value = true
  const reducedMotion = typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches
  miniAnchorRef.value?.scrollIntoView?.({
    behavior: reducedMotion ? 'auto' : 'smooth',
    block: 'center'
  })
  void exitMiniMode()
}

function handleMiniIntersection(entries) {
  const entry = entries[0]
  if (!entry) return
  if (entry.target === miniAnchorRef.value) {
    if (entry.isIntersecting && entry.intersectionRatio > 0) {
      miniSourceVisible.value = true
      void exitMiniMode()
    }
    return
  }
  miniSourceVisible.value = entry.isIntersecting && entry.intersectionRatio > 0
  if (miniSourceVisible.value) {
    miniDismissed.value = false
    return
  }
  if (!entry.isIntersecting || entry.intersectionRatio === 0) {
    void enterMiniMode()
  }
}

function setupMiniObserver() {
  miniObserver?.disconnect()
  miniObserver = null
  if (!props.miniMode) {
    miniDismissed.value = false
    miniSourceVisible.value = true
    void exitMiniMode()
    return
  }
  if (typeof IntersectionObserver !== 'function') return
  miniObserver = new IntersectionObserver(handleMiniIntersection, { threshold: 0 })
  observeMiniTarget(playerElement())
}

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

function clearErrorNoticeTimer() {
  if (errorNoticeTimer !== null) {
    clearTimeout(errorNoticeTimer)
    errorNoticeTimer = null
  }
}

function showErrorNotice(error) {
  clearErrorNoticeTimer()
  const code = safeLogCode(error?.code)
  errorNotice.value = {
    code: code ?? 'UNSAFE_CODE',
    message: code
      ? (diagnosticCodeLabels[code] ?? '播放发生错误')
      : '播放发生错误'
  }
  errorNoticeTimer = setTimeout(() => {
    errorNotice.value = null
    errorNoticeTimer = null
  }, 5000)
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
    controlsAutoHideStates.has(state.value) &&
    !controlsFocused.value &&
    !settingsOpen.value &&
    !contextMenu.value.open &&
    !diagnosticsOpen.value
  ) {
    hideTimer = setTimeout(() => {
      controlsVisible.value = false
      hideTimer = null
    }, CONTROLS_HIDE_DELAY)
  }
}

function showControls() {
  controlsVisible.value = true
  scheduleHide()
}

function onFocusIn() {
  controlsVisible.value = true
  controlsFocused.value = lastInteractionWasKeyboard
  if (controlsFocused.value) clearHideTimer()
  else scheduleHide()
}

function onFocusOut(event) {
  if (event.currentTarget.contains(event.relatedTarget)) return
  controlsFocused.value = false
  scheduleHide()
}

function sameSource(left, right) {
  return Object.is(left, right)
}

function resetAutoRecoveryBudget(source = null, time = 0) {
  autoRecoveryBudget = { source, time, attempts: 0 }
}

function reserveAutoRecovery(context) {
  if (
    !sameSource(autoRecoveryBudget.source, context.source) ||
    Math.abs(autoRecoveryBudget.time - context.time) > AUTO_RECOVERY_POSITION_WINDOW
  ) {
    resetAutoRecoveryBudget(context.source, context.time)
  }
  if (autoRecoveryBudget.attempts >= 1) return false
  autoRecoveryBudget.attempts += 1
  return true
}

function invalidateRecovery({ clearFailed = true, resetBudget = false } = {}) {
  recoveryEpoch += 1
  recoveryPromise = null
  recoverySource = null
  runtimeRecoveryContext = null
  if (clearFailed) {
    failedPlaybackContext = null
    replayVisible.value = false
  }
  if (resetBudget) resetAutoRecoveryBudget()
}

function handleEvent(name, payload) {
  appendPlayerLog(name, payload)
  switch (name) {
    case 'loading':
      {
        const loadingSource = payload?.source ?? props.src
        sourceGeneration += 1
        const isRecoveryLoad = (
          recoverySource !== null && sameSource(recoverySource, loadingSource)
        )
        if (!isRecoveryLoad) {
          invalidateRecovery({ clearFailed: true, resetBudget: true })
        }
      }
      publicError.value = null
      replayVisible.value = false
      activeSource.value = payload?.source ?? activeSource.value ?? props.src
      if ((payload?.source ?? props.src) !== posterSource.value) {
        posterSource.value = payload?.source ?? props.src
        posterDismissed.value = false
      }
      controlsVisible.value = true
      break
    case 'statechange':
      if (payload.state === PlayerState.ERROR && [
        PlayerState.PLAYING,
        PlayerState.PAUSED,
        PlayerState.SEEKING
      ].includes(payload.previousState)) {
        runtimeRecoveryContext = {
          source: activeSource.value ?? props.src,
          time: currentTime.value,
          resumePlaying: desiredPlaying || payload.previousState === PlayerState.PLAYING
        }
        failedPlaybackContext = runtimeRecoveryContext
      }
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
      if (payload.state === PlayerState.PLAYING) {
        replayVisible.value = false
        failedPlaybackContext = null
        if (!miniSourceVisible.value) void enterMiniMode()
      }
      if ([PlayerState.ENDED, PlayerState.STOPPED].includes(payload.state)) {
        void exitMiniMode()
      }
      if (controlsAutoHideStates.has(state.value)) scheduleHide()
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
      if (
        autoRecoveryBudget.attempts > 0 &&
        sameSource(autoRecoveryBudget.source, activeSource.value) &&
        payload.currentTime >= autoRecoveryBudget.time + AUTO_RECOVERY_RESET_PROGRESS
      ) {
        resetAutoRecoveryBudget()
      }
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
      showErrorNotice(payload)
      controlsVisible.value = true
      clearHideTimer()
      if (payload?.code === 'AUTOPLAY_BLOCKED') {
        replayVisible.value = false
      } else if (recoveryPromise || recoverySource !== null) {
        replayVisible.value = false
      } else if (runtimeRecoveryContext && payload?.recoverable) {
        const context = runtimeRecoveryContext
        runtimeRecoveryContext = null
        if (reserveAutoRecovery(context)) void recoverPlayback(context)
        else replayVisible.value = true
      } else {
        replayVisible.value = true
        failedPlaybackContext ??= {
          source: activeSource.value ?? props.src,
          time: currentTime.value,
          resumePlaying: true
        }
      }
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

function recoveryIsCurrent(epoch, source) {
  return (
    !disposed &&
    epoch === recoveryEpoch &&
    sameSource(activeSource.value, source)
  )
}

async function restoreFailedPlayback(context, forcePlay, epoch) {
  const source = context?.source ?? activeSource.value ?? props.src
  if (!source) {
    replayVisible.value = true
    return false
  }

  replayVisible.value = false
  try {
    const generationBeforeLoad = sourceGeneration
    await coreRef.value?.load(source)
    if (
      sourceGeneration !== generationBeforeLoad + 1 ||
      !recoveryIsCurrent(epoch, source)
    ) return false
    if (context?.time > 0) {
      await coreRef.value?.seek(context.time)
      if (!recoveryIsCurrent(epoch, source)) return false
    }
    if (forcePlay || context?.resumePlaying) {
      if (!recoveryIsCurrent(epoch, source)) return false
      desiredPlaying = true
      visualPlaying.value = true
      await play()
      if (!recoveryIsCurrent(epoch, source)) return false
      commandedPlaying = true
    }
    publicError.value = null
    return true
  } catch {
    if (!disposed && epoch === recoveryEpoch) replayVisible.value = true
    return false
  }
}

function recoverPlayback(context, forcePlay = false) {
  if (recoveryPromise) return recoveryPromise
  const source = context?.source ?? activeSource.value ?? props.src
  const epoch = ++recoveryEpoch
  recoverySource = source
  const promise = restoreFailedPlayback(context, forcePlay, epoch)
  recoveryPromise = promise
  void promise.finally(() => {
    if (recoveryPromise !== promise) return
    recoveryPromise = null
    recoverySource = null
  })
  return promise
}

function replayPlayback() {
  const context = failedPlaybackContext ?? {
    source: activeSource.value ?? props.src,
    time: currentTime.value,
    resumePlaying: true
  }
  failedPlaybackContext = context
  return recoverPlayback({ ...context, resumePlaying: true }, true)
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
  if (revealOnlySurfaceClick) {
    revealOnlySurfaceClick = false
    return
  }
  togglePlayback()
}

function handlePointerActivity() {
  lastInteractionWasKeyboard = false
  showControls()
}

function handlePointerDown(event) {
  lastInteractionWasKeyboard = false
  revealOnlySurfaceClick = !controlsVisible.value && isSurfaceEvent(event)
  if (isSurfaceEvent(event) && event.pointerType !== 'touch') {
    coreRef.value?.$el?.focus?.({ preventScroll: true })
  }
  showControls()
}

function handlePointerCancel() {
  revealOnlySurfaceClick = false
}

function handleTouchStart(event) {
  lastInteractionWasKeyboard = false
  if (!controlsVisible.value && isSurfaceEvent(event)) {
    revealOnlySurfaceClick = true
  }
  showControls()
}

function handleContextMenu(event) {
  if (!isSurfaceEvent(event)) return
  event.preventDefault()
  const playerRect = event.currentTarget.getBoundingClientRect()
  contextMenu.value = {
    open: true,
    x: event.clientX - playerRect.left,
    y: event.clientY - playerRect.top
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

function statValue(stats, ...keys) {
  for (const key of keys) {
    const value = stats?.[key]
    if (typeof value === 'string' && value.trim()) return value
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return '--'
}

function positiveStat(stats, ...keys) {
  const value = statValue(stats, ...keys)
  return typeof value === 'number' && value > 0 ? value : null
}

function trimFixed(value, digits = 2) {
  return Number(value.toFixed(digits)).toString()
}

function formatBitrate(value) {
  if (!Number.isFinite(value) || value <= 0) return '--'
  if (value >= 1_000_000) return `${trimFixed(value / 1_000_000)} Mbps`
  if (value >= 1_000) return `${trimFixed(value / 1_000)} kbps`
  return `${Math.round(value)} bps`
}

function formatSampleRate(value) {
  if (!Number.isFinite(value) || value <= 0) return '--'
  return value >= 1_000 ? `${trimFixed(value / 1_000)} kHz` : `${Math.round(value)} Hz`
}

function formatChannels(value) {
  if (!Number.isFinite(value) || value <= 0) return '--'
  if (value === 1) return '1（单声道）'
  if (value === 2) return '2（立体声）'
  return `${value}`
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
  const videoBitrate = positiveStat(stats, 'videoBitrate')
  const audioBitrate = positiveStat(stats, 'audioBitrate')
  const totalBitrate = videoBitrate || audioBitrate
    ? (videoBitrate ?? 0) + (audioBitrate ?? 0)
    : positiveStat(stats, 'bitrate')
  const frameRate = positiveStat(
    stats,
    'videoEncodeFramerate',
    'videoRenderFramerate',
    'videoDecodeFramerate',
    'fps'
  )
  const source = sourceDetails(activeSource.value)

  return [
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
    { label: '视频编码', value: statValue(stats, 'videocodec', 'videoCodec') },
    { label: '音频编码', value: statValue(stats, 'audiocodec', 'audioCodec') },
    { label: '分辨率', value: resolution },
    { label: '帧率', value: frameRate ? `${trimFixed(frameRate)} fps` : '--' },
    { label: '总码率', value: formatBitrate(totalBitrate) },
    { label: '视频码率', value: formatBitrate(videoBitrate) },
    { label: '音频码率', value: formatBitrate(audioBitrate) },
    { label: '音频采样率', value: formatSampleRate(positiveStat(stats, 'sampleRate')) },
    { label: '音频声道', value: formatChannels(positiveStat(stats, 'channels')) },
    { label: '视频轨道', value: core.videoTracks.length },
    { label: '音频轨道', value: core.audioTracks.length },
    { label: '字幕轨道', value: core.subtitleTracks.length }
  ]
}

function buildPlayerInfo() {
  return [
    { label: '播放器库', value: LIBMEDIA_AVP_NAME },
    { label: '播放器库版本', value: LIBMEDIA_AVP_VERSION },
    { label: 'AVPlayer / libmedia 版本', value: LIBMEDIA_AVPLAYER_VERSION },
    {
      label: 'GitHub 地址',
      value: LIBMEDIA_AVP_REPOSITORY,
      href: LIBMEDIA_AVP_REPOSITORY
    }
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

watch(() => props.miniMode, setupMiniObserver)

watch(() => props.src, (source, previousSource) => {
  if (sameSource(source, previousSource)) return
  invalidateRecovery({ clearFailed: true, resetBudget: true })
}, { flush: 'sync' })

function refreshTracks(core) {
  run(Promise.all([
    core.getVideoList(),
    core.getAudioList(),
    core.getSubtitleList()
  ]))
}

function playerElement() {
  return coreRef.value?.$el ?? null
}

function nativeFullscreenElement() {
  return document.fullscreenElement ?? document.webkitFullscreenElement ?? null
}

function restorePageOverflow() {
  if (bodyOverflowBeforeFullscreen === null) return
  document.body.style.overflow = bodyOverflowBeforeFullscreen
  bodyOverflowBeforeFullscreen = null
}

function enterPseudoFullscreen() {
  if (disposed || !fullscreenDesired.value) return
  if (bodyOverflowBeforeFullscreen === null) {
    bodyOverflowBeforeFullscreen = document.body.style.overflow
  }
  document.body.style.overflow = 'hidden'
  fullscreenMode.value = 'pseudo'
}

async function exitNativeFullscreen(player = playerElement()) {
  const exit = document.exitFullscreen ?? document.webkitExitFullscreen
  if (typeof exit !== 'function' || nativeFullscreenElement() !== player) return
  try {
    await exit.call(document)
  } catch {}
}

function syncFullscreenState() {
  if (disposed) return
  const active = nativeFullscreenElement()
  const player = playerElement()
  if (active === player) {
    if (fullscreenDesired.value) fullscreenMode.value = 'native'
    else void exitNativeFullscreen(player)
  } else if (fullscreenMode.value === 'native') {
    fullscreenDesired.value = false
    fullscreenEpoch += 1
    fullscreenMode.value = null
  }
}

async function enterCompleteFullscreen() {
  const player = playerElement()
  if (!player || disposed || fullscreenDesired.value) return
  fullscreenDesired.value = true
  const epoch = ++fullscreenEpoch
  const request = player.requestFullscreen ?? player.webkitRequestFullscreen
  if (typeof request === 'function') {
    try {
      await request.call(player)
      if (disposed || epoch !== fullscreenEpoch || !fullscreenDesired.value) {
        await exitNativeFullscreen(player)
        return
      }
      fullscreenMode.value = 'native'
      return
    } catch {
      // iOS/WebView implementations may expose but reject element fullscreen.
    }
  }
  if (disposed || epoch !== fullscreenEpoch || !fullscreenDesired.value) return
  enterPseudoFullscreen()
}

async function exitCompleteFullscreen() {
  fullscreenDesired.value = false
  fullscreenEpoch += 1
  if (fullscreenMode.value === 'pseudo') {
    fullscreenMode.value = null
    restorePageOverflow()
    return
  }
  await exitNativeFullscreen()
  fullscreenMode.value = null
}

function toggleFullscreen() {
  return fullscreen.value ? exitCompleteFullscreen() : enterCompleteFullscreen()
}

function handleKeydown(event) {
  if (!props.controls) return
  lastInteractionWasKeyboard = true
  const target = event.target
  const editing = target instanceof Element && target.closest(
    'button, input, select, textarea, [contenteditable="true"]'
  )
  const key = event.key.toLowerCase()
  const seekKeyOnButton = editing?.matches('button') && [
    'arrowleft',
    'arrowright',
    'j',
    'l'
  ].includes(key)
  if (editing && key !== 'escape' && !seekKeyOnButton) return

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
    f: () => run(toggleFullscreen()),
    escape: () => {
      if (settingsOpen.value) setSettingsOpen(false)
      else run(exitCompleteFullscreen())
    }
  }
  const action = actions[key]
  if (!action) return
  event.preventDefault()
  showControls()
  action()
}

const load = (source = props.src) => {
  invalidateRecovery({ clearFailed: true, resetBudget: true })
  return coreRef.value?.load(source)
}
const pause = () => coreRef.value?.pause()
const stop = () => coreRef.value?.stop()
const seek = (seconds) => coreRef.value?.seek(seconds)
const setPublicVolume = (value) => coreRef.value?.setVolume(value)
const mute = () => coreRef.value?.mute()
const unmute = () => coreRef.value?.unmute()
const enterFullscreen = () => enterCompleteFullscreen()
const exitFullscreen = () => exitCompleteFullscreen()
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

onMounted(() => {
  disposed = false
  document.addEventListener('fullscreenchange', syncFullscreenState)
  document.addEventListener('webkitfullscreenchange', syncFullscreenState)
  setupMiniObserver()
})

onBeforeUnmount(() => {
  disposed = true
  fullscreenDesired.value = false
  fullscreenEpoch += 1
  invalidateRecovery({ clearFailed: true })
  clearHideTimer()
  clearFeedbackTimer()
  clearStallTimer()
  clearErrorNoticeTimer()
  document.removeEventListener('fullscreenchange', syncFullscreenState)
  document.removeEventListener('webkitfullscreenchange', syncFullscreenState)
  miniObserver?.disconnect()
  miniObserver = null
  if (fullscreenMode.value === 'pseudo') restorePageOverflow()
  else void exitNativeFullscreen()
})
</script>

<template>
  <div
    ref="miniAnchorRef"
    v-show="miniActive"
    class="libmedia-mini-anchor"
    :style="miniAnchorStyle"
    aria-hidden="true"
  />
  <LibmediaPlayerCore
    v-bind="attrs"
    ref="coreRef"
    v-slot="core"
    class="libmedia-player"
    :class="{
      'libmedia-player--controls-hidden': controls && !controlsVisible,
      'libmedia-player--settings-open': settingsOpen,
      'libmedia-player--fullscreen': fullscreenMode === 'native',
      'libmedia-player--pseudo-fullscreen': fullscreenMode === 'pseudo',
      'libmedia-player--mini': miniActive
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
    @pointermove="handlePointerActivity"
    @pointerdown="handlePointerDown"
    @pointercancel="handlePointerCancel"
    @touchstart.passive="handleTouchStart"
    @touchcancel.passive="handlePointerCancel"
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
      :replay="replayVisible"
      @replay="run(replayPlayback())"
      @play="requestPlayback(true)"
    >
      <template v-if="$slots.loading" #loading="slotProps">
        <slot name="loading" v-bind="slotProps" />
      </template>
      <template v-if="$slots.error" #error="slotProps">
        <slot name="error" v-bind="slotProps" />
      </template>
    </PlayerStatusOverlay>

    <div
      v-if="errorNotice"
      class="libmedia-error-notice"
      role="status"
      aria-live="polite"
    >
      <strong>{{ errorNotice.message }}</strong>
      <code>{{ errorNotice.code }}</code>
    </div>

    <PlayerControls
      v-if="controls"
      :state="state"
      :playing="visualPlaying"
      :current-time="core.currentTime"
      :duration="core.duration"
      :buffered="core.currentTime"
      :volume="core.volume"
      :muted="core.muted"
      :settings-open="settingsOpen"
      :fullscreen="fullscreen"
      @toggle-play="togglePlayback"
      @seek="seekTo"
      @volume="setVolume"
      @toggle-mute="toggleMute"
      @fullscreen="run(toggleFullscreen())"
      @toggle-settings="setSettingsOpen"
    >
      <template #extra>
        <slot name="controls-extra" :state="state" />
      </template>
    </PlayerControls>

    <div v-if="miniActive" class="libmedia-mini" @click.stop>
      <button
        type="button"
        class="libmedia-mini__button libmedia-mini__toggle"
        :aria-label="visualPlaying ? '暂停' : '播放'"
        @click="togglePlayback"
      >
        <PauseIcon v-if="visualPlaying" />
        <PlayIcon v-else />
      </button>
      <button
        type="button"
        class="libmedia-mini__button libmedia-mini__restore"
        aria-label="返回视频位置"
        @click="restoreMiniMode"
      >
        <RestoreIcon />
      </button>
      <button
        type="button"
        class="libmedia-mini__button libmedia-mini__close"
        aria-label="关闭小窗"
        @click="dismissMiniMode"
      >
        <CloseIcon />
      </button>
    </div>

    <PlayerSettings
      v-if="controls"
      :open="settingsOpen"
      :playback-rate="core.playbackRate"
      :video-tracks="core.videoTracks"
      :audio-tracks="core.audioTracks"
      :subtitle-tracks="core.subtitleTracks"
      @close="setSettingsOpen(false)"
      @refresh="refreshTracks(core)"
      @rate="run(core.setPlaybackRate($event))"
      @select-video="run(core.selectVideo($event, true))"
      @select-audio="run(core.selectAudio($event, true))"
      @select-subtitle="run(core.selectSubtitle($event))"
    />

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
      :player-info="buildPlayerInfo()"
      :logs="playerLogs"
      @close="closeDiagnostics"
      @tab="diagnosticsTab = $event"
    />
  </LibmediaPlayerCore>
</template>
