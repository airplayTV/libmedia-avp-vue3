import type { DefineComponent, Ref, ShallowRef } from 'vue'

export type PlayerSource = string | File | null
export type WasmVariant = 'auto' | 'baseline' | 'simd' | 'atomic'
export type PlayerStateValue =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'seeking'
  | 'ended'
  | 'stopped'
  | 'error'
  | 'destroyed'

export interface PlayerPublicError {
  code: string
  message: string
  recoverable: boolean
  requiresUserGesture: boolean
  details: Record<string, unknown>
}

export interface PlayerTrack {
  id: number
  codec?: string
  language?: string
  title?: string
  [key: string]: unknown
}

export interface VideoTrack extends PlayerTrack {
  width?: number
  height?: number
}

export interface AudioTrack extends PlayerTrack {
  sampleRate?: number
  channels?: number
}

export interface SubtitleTrack extends PlayerTrack {}

export interface LibmediaPlayerCoreProps {
  src?: PlayerSource
  autoplay?: boolean
  muted?: boolean
  volume?: number
  loop?: boolean
  poster?: string
  controls?: boolean
  playsinline?: boolean
  assetBaseUrl?: string
  wasmVariant?: WasmVariant
  loadOptions?: Record<string, unknown>
  engineOptions?: Record<string, unknown>
}

export interface LibmediaPlayerProps extends LibmediaPlayerCoreProps {
  miniMode?: boolean
  themeColor?: string
}

export interface PlayerStateEvent {
  state: PlayerStateValue
  previousState?: PlayerStateValue
}

export interface PlayerTimeEvent {
  currentTime: number
  duration: number
}

export interface PlayerVolumeEvent {
  volume: number
  muted: boolean
}

export type PlayerEventName =
  | 'loading'
  | 'ready'
  | 'play'
  | 'pause'
  | 'timeupdate'
  | 'durationchange'
  | 'seeking'
  | 'seeked'
  | 'ended'
  | 'volumechange'
  | 'statechange'
  | 'diagnostic'
  | 'error'

export interface LibmediaPlayerExposed {
  load(source?: PlayerSource): Promise<void> | undefined
  play(options?: Record<string, unknown>): Promise<void> | undefined
  pause(): Promise<void> | undefined
  stop(): Promise<void> | undefined
  seek(seconds: number): Promise<void> | undefined
  setVolume(volume: number): Promise<void> | undefined
  mute(): Promise<void> | undefined
  unmute(): Promise<void> | undefined
  enterFullscreen(): Promise<void> | undefined
  exitFullscreen(): Promise<void> | undefined
  getStats(): unknown
}

export interface UseLibmediaPlayerOptions {
  src?: PlayerSource | Ref<PlayerSource>
  volume?: number
  muted?: boolean
  assetBaseUrl?: string | Ref<string>
  wasmVariant?: WasmVariant | Ref<WasmVariant>
  loadOptions?: Record<string, unknown> | Ref<Record<string, unknown>>
  engineOptions?: Record<string, unknown> | Ref<Record<string, unknown>>
  onEvent?: (name: PlayerEventName | 'diagnostic', payload: unknown) => void
}

export interface UseLibmediaPlayerResult extends LibmediaPlayerExposed {
  containerRef: Ref<HTMLElement | null>
  state: Ref<PlayerStateValue>
  currentTime: Ref<number>
  duration: Ref<number>
  volume: Ref<number>
  muted: Ref<boolean>
  playbackRate: Ref<number>
  videoTracks: ShallowRef<VideoTrack[]>
  audioTracks: ShallowRef<AudioTrack[]>
  subtitleTracks: ShallowRef<SubtitleTrack[]>
  error: ShallowRef<PlayerPublicError | null>
  setPlaybackRate(rate: number): Promise<number>
  getVideoList(): Promise<VideoTrack[]>
  getAudioList(): Promise<AudioTrack[]>
  getSubtitleList(): Promise<SubtitleTrack[]>
  selectVideo(id: number, smooth?: boolean): Promise<void>
  selectAudio(id: number, smooth?: boolean): Promise<void>
  selectSubtitle(id: number): Promise<void>
  resize(width: number, height: number): Promise<void>
  destroy(): Promise<void>
}

export declare const LIBMEDIA_AVP_NAME: 'libmedia-avp-vue3'
export declare const LIBMEDIA_AVP_VERSION: '0.1.6'
export declare const LIBMEDIA_AVP_REPOSITORY: 'https://github.com/airplayTV/libmedia-avp-vue3'
export declare const LIBMEDIA_AVP_INFO: Readonly<{
  name: typeof LIBMEDIA_AVP_NAME
  version: typeof LIBMEDIA_AVP_VERSION
  repository: typeof LIBMEDIA_AVP_REPOSITORY
}>
export declare const LIBMEDIA_CONTROLLER_FACTORY: 'libmediaControllerFactory'
export declare const PlayerState: Readonly<{
  IDLE: 'idle'
  LOADING: 'loading'
  READY: 'ready'
  PLAYING: 'playing'
  PAUSED: 'paused'
  SEEKING: 'seeking'
  ENDED: 'ended'
  STOPPED: 'stopped'
  ERROR: 'error'
  DESTROYED: 'destroyed'
}>

export declare class PlayerError extends Error {
  readonly code: string
  readonly recoverable: boolean
  readonly requiresUserGesture: boolean
  readonly source?: PlayerSource
  readonly details: Record<string, unknown>
  constructor(code: string, message: string, options?: Record<string, unknown>)
  toPublicJSON(): PlayerPublicError
}

export declare function canTransition(
  from: PlayerStateValue,
  to: PlayerStateValue
): boolean
export declare function engineTimeToSeconds(value: bigint | number): number
export declare function secondsToEngineTime(value: number): bigint
export declare function normalizePlayerError(
  error: unknown,
  context?: Record<string, unknown>
): PlayerError
export declare function useLibmediaPlayer(
  options?: UseLibmediaPlayerOptions
): UseLibmediaPlayerResult

export declare const LibmediaPlayerCore: DefineComponent<LibmediaPlayerCoreProps>
export declare const LibmediaPlayer: DefineComponent<LibmediaPlayerProps>
