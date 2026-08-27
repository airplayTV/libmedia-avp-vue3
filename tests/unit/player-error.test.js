import { describe, expect, it } from 'vitest'
import {
  PlayerError,
  normalizePlayerError
} from '../../src/core/player-error.js'

describe('player errors', () => {
  it('preserves diagnostics internally and exposes a sanitized payload', () => {
    const cause = new Error('fetch failed')
    const error = normalizePlayerError(cause, {
      code: 'WASM_LOAD_FAILED',
      source: 'https://media.example/video.mp4?token=secret',
      recoverable: true,
      details: {
        codec: 'h264',
        sourceUrl: 'https://media.example/private.wasm',
        nested: { operation: 'decode', authorization: 'secret' }
      }
    })

    expect(error).toMatchObject({
      name: 'PlayerError',
      code: 'WASM_LOAD_FAILED',
      recoverable: true,
      requiresUserGesture: false,
      source: 'https://media.example/video.mp4?token=secret'
    })
    expect(error.cause).toBe(cause)
    expect(error.toPublicJSON()).toEqual({
      code: 'WASM_LOAD_FAILED',
      message: 'fetch failed',
      recoverable: true,
      requiresUserGesture: false,
      details: {
        codec: 'h264',
        nested: { operation: 'decode' }
      }
    })
  })

  it('preserves an existing player error when no context overrides it', () => {
    const error = new PlayerError('AUTOPLAY_BLOCKED', 'Interaction required', {
      recoverable: true,
      requiresUserGesture: true
    })

    expect(normalizePlayerError(error)).toBe(error)
  })
})
