export const LIBMEDIA_AVP_VERSION = '0.1.0'

export { PlayerState, canTransition } from './core/player-state.js'
export { engineTimeToSeconds, secondsToEngineTime } from './core/time.js'
export { PlayerError, normalizePlayerError } from './core/player-error.js'
export { useLibmediaPlayer } from './composables/use-libmedia-player.js'
export { default as LibmediaPlayerCore } from './components/LibmediaPlayerCore.vue'
