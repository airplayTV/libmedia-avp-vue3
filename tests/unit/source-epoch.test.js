import { describe, expect, it } from 'vitest'
import { SourceEpoch } from '../../src/core/source-epoch.js'

describe('source epoch', () => {
  it('increments monotonically and identifies only the current source', () => {
    const epoch = new SourceEpoch()

    expect(epoch.current).toBe(0)
    expect(epoch.next()).toBe(1)
    expect(epoch.isCurrent(1)).toBe(true)
    expect(epoch.isCurrent(0)).toBe(false)
    expect(epoch.next()).toBe(2)
    expect(epoch.isCurrent(1)).toBe(false)
  })
})
