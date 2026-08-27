export const PlayerState = Object.freeze({
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  PLAYING: 'playing',
  PAUSED: 'paused',
  SEEKING: 'seeking',
  ENDED: 'ended',
  STOPPED: 'stopped',
  ERROR: 'error',
  DESTROYED: 'destroyed'
})

const transitions = {
  [PlayerState.IDLE]: [PlayerState.LOADING, PlayerState.DESTROYED],
  [PlayerState.LOADING]: [
    PlayerState.READY,
    PlayerState.PLAYING,
    PlayerState.STOPPED,
    PlayerState.ERROR,
    PlayerState.DESTROYED
  ],
  [PlayerState.READY]: [
    PlayerState.LOADING,
    PlayerState.PLAYING,
    PlayerState.PAUSED,
    PlayerState.STOPPED,
    PlayerState.ERROR,
    PlayerState.DESTROYED
  ],
  [PlayerState.PLAYING]: [
    PlayerState.LOADING,
    PlayerState.PAUSED,
    PlayerState.SEEKING,
    PlayerState.ENDED,
    PlayerState.STOPPED,
    PlayerState.ERROR,
    PlayerState.DESTROYED
  ],
  [PlayerState.PAUSED]: [
    PlayerState.LOADING,
    PlayerState.PLAYING,
    PlayerState.SEEKING,
    PlayerState.ENDED,
    PlayerState.STOPPED,
    PlayerState.ERROR,
    PlayerState.DESTROYED
  ],
  [PlayerState.SEEKING]: [
    PlayerState.LOADING,
    PlayerState.READY,
    PlayerState.PLAYING,
    PlayerState.PAUSED,
    PlayerState.ENDED,
    PlayerState.STOPPED,
    PlayerState.ERROR,
    PlayerState.DESTROYED
  ],
  [PlayerState.ENDED]: [
    PlayerState.LOADING,
    PlayerState.PLAYING,
    PlayerState.SEEKING,
    PlayerState.STOPPED,
    PlayerState.ERROR,
    PlayerState.DESTROYED
  ],
  [PlayerState.STOPPED]: [
    PlayerState.LOADING,
    PlayerState.ERROR,
    PlayerState.DESTROYED
  ],
  [PlayerState.ERROR]: [
    PlayerState.LOADING,
    PlayerState.STOPPED,
    PlayerState.DESTROYED
  ],
  [PlayerState.DESTROYED]: []
}

const knownStates = new Set(Object.values(PlayerState))

export function canTransition(from, to) {
  if (!knownStates.has(from) || !knownStates.has(to)) {
    return false
  }

  return from === to || transitions[from].includes(to)
}

