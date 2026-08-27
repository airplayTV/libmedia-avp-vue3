import { PlayerError } from './player-error.js'

export function secondsToEngineTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new PlayerError(
      'INVALID_TIME',
      'Time must be a non-negative finite number'
    )
  }

  return BigInt(Math.round(seconds * 1000))
}

export function engineTimeToSeconds(value) {
  return Number(value) / 1000
}
