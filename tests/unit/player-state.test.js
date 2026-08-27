import { describe, expect, it } from 'vitest'
import { PlayerState, canTransition } from '../../src/core/player-state.js'

describe('player state transitions', () => {
  it('allows loading an idle player', () => {
    expect(canTransition(PlayerState.IDLE, PlayerState.LOADING)).toBe(true)
  })

  it('prevents a destroyed player from becoming active again', () => {
    expect(canTransition(PlayerState.DESTROYED, PlayerState.LOADING)).toBe(false)
  })

  it('allows repeated state notifications without forcing a transition', () => {
    expect(canTransition(PlayerState.PLAYING, PlayerState.PLAYING)).toBe(true)
  })

  it('rejects unknown states', () => {
    expect(canTransition('unknown', PlayerState.LOADING)).toBe(false)
    expect(canTransition(PlayerState.IDLE, 'unknown')).toBe(false)
  })

  it('exposes immutable state values', () => {
    expect(Object.isFrozen(PlayerState)).toBe(true)
  })
})

