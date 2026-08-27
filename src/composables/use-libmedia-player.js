import {
  inject,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  unref,
  watch
} from 'vue'
import { PlayerError, normalizePlayerError } from '../core/player-error.js'
import { PlayerState } from '../core/player-state.js'
import { createDefaultController } from '../core/default-controller-factory.js'

export const LIBMEDIA_CONTROLLER_FACTORY = 'libmediaControllerFactory'

function toPublicError(error) {
  const normalized = error instanceof PlayerError
    ? error
    : normalizePlayerError(error, { code: 'MEDIA_LOAD_FAILED' })
  return normalized.toPublicJSON()
}

export function useLibmediaPlayer(options = {}) {
  const injectedFactory = inject(LIBMEDIA_CONTROLLER_FACTORY, null)
  const controllerFactory = options.controllerFactory ?? injectedFactory ?? createDefaultController
  const containerRef = ref(null)
  const controller = shallowRef(null)
  const state = ref(PlayerState.IDLE)
  const currentTime = ref(0)
  const duration = ref(0)
  const volume = ref(options.volume ?? 1)
  const muted = ref(options.muted === true)
  const playbackRate = ref(1)
  const videoTracks = shallowRef([])
  const audioTracks = shallowRef([])
  const subtitleTracks = shallowRef([])
  const error = shallowRef(null)

  let mounted = false
  let disposed = false
  let initializationPromise = Promise.resolve(null)
  let cleanupPromise = Promise.resolve()

  function handleEvent(name, payload) {
    switch (name) {
      case 'loading':
        error.value = null
        break
      case 'statechange':
        state.value = payload.state
        break
      case 'timeupdate':
        currentTime.value = payload.currentTime
        duration.value = payload.duration
        break
      case 'durationchange':
      case 'ready':
        duration.value = payload.duration
        break
      case 'volumechange':
        volume.value = payload.volume
        muted.value = payload.muted
        break
      case 'error':
        error.value = payload
        break
    }

    options.onEvent?.(name, payload)
  }

  function recordCommandError(commandError) {
    error.value = toPublicError(commandError)
    return commandError
  }

  async function getController() {
    const instance = controller.value ?? await initializationPromise
    if (!instance) {
      throw new PlayerError(
        'RUNTIME_LOAD_FAILED',
        'Player controller is not available'
      )
    }
    return instance
  }

  async function invoke(method, ...args) {
    try {
      const instance = await getController()
      return await instance[method](...args)
    } catch (commandError) {
      throw recordCommandError(commandError)
    }
  }

  const load = (source = unref(options.src)) => invoke('load', source)
  const play = (playOptions) => invoke('play', playOptions)
  const pause = () => invoke('pause')
  const stop = () => invoke('stop')
  const seek = (seconds) => invoke('seek', seconds)
  const setVolume = async (nextVolume) => {
    await invoke('setVolume', nextVolume)
    volume.value = Math.min(1, Math.max(0, nextVolume))
    muted.value = volume.value === 0
  }
  const mute = async () => {
    await invoke('mute')
    muted.value = true
    volume.value = 0
  }
  const unmute = async () => {
    await invoke('unmute')
    muted.value = false
  }
  const setPlaybackRate = async (rate) => {
    playbackRate.value = await invoke('setPlaybackRate', rate)
    return playbackRate.value
  }
  const getVideoList = async () => {
    videoTracks.value = await invoke('getVideoList')
    return videoTracks.value
  }
  const getAudioList = async () => {
    audioTracks.value = await invoke('getAudioList')
    return audioTracks.value
  }
  const getSubtitleList = async () => {
    subtitleTracks.value = await invoke('getSubtitleList')
    return subtitleTracks.value
  }
  const selectVideo = (id, smooth) => invoke('selectVideo', id, smooth)
  const selectAudio = (id, smooth) => invoke('selectAudio', id, smooth)
  const selectSubtitle = (id) => invoke('selectSubtitle', id)
  const resize = (width, height) => invoke('resize', width, height)
  const enterFullscreen = () => invoke('enterFullscreen')
  const exitFullscreen = () => invoke('exitFullscreen')
  const getStats = () => controller.value?.getStats() ?? null
  const destroy = async () => {
    const instance = controller.value ?? await initializationPromise
    await instance?.destroy()
  }

  onMounted(() => {
    mounted = true
    const initialSource = unref(options.src)

    initializationPromise = Promise.resolve().then(async () => {
      const instance = await controllerFactory({
        container: containerRef.value,
        source: initialSource,
        assetBaseUrl: unref(options.assetBaseUrl),
        wasmVariant: unref(options.wasmVariant) ?? 'auto',
        engineOptions: unref(options.engineOptions) ?? {},
        loadOptions: unref(options.loadOptions) ?? {},
        onEvent: handleEvent
      })

      if (disposed) {
        await instance.destroy()
        return null
      }

      controller.value = instance
      if (initialSource !== null && initialSource !== undefined && initialSource !== '') {
        try {
          await instance.load(initialSource)
        } catch (loadError) {
          recordCommandError(loadError)
        }
      }
      return instance
    }).catch((initializationError) => {
      recordCommandError(initializationError)
      return null
    })
  })

  watch(
    () => unref(options.src),
    (nextSource, previousSource) => {
      if (!mounted || nextSource === previousSource) return

      void initializationPromise.then(async (instance) => {
        if (!instance || disposed) return
        try {
          if (nextSource === null || nextSource === undefined || nextSource === '') {
            await instance.stop()
          } else {
            await instance.load(nextSource)
          }
        } catch (sourceError) {
          recordCommandError(sourceError)
        }
      })
    }
  )

  onBeforeUnmount(() => {
    disposed = true
    cleanupPromise = initializationPromise.then(async (instance) => {
      await instance?.destroy()
      controller.value = null
    })
    void cleanupPromise.catch(recordCommandError)
  })

  return {
    containerRef,
    state,
    currentTime,
    duration,
    volume,
    muted,
    playbackRate,
    videoTracks,
    audioTracks,
    subtitleTracks,
    error,
    load,
    play,
    pause,
    stop,
    seek,
    setVolume,
    mute,
    unmute,
    setPlaybackRate,
    getVideoList,
    getAudioList,
    getSubtitleList,
    selectVideo,
    selectAudio,
    selectSubtitle,
    resize,
    enterFullscreen,
    exitFullscreen,
    getStats,
    destroy
  }
}
