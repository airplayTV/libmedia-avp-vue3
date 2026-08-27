import { describe, expect, it } from 'vitest'
import { OperationQueue } from '../../src/core/operation-queue.js'
import { PlayerError } from '../../src/core/player-error.js'

describe('operation queue', () => {
  it('executes asynchronous operations in FIFO order', async () => {
    const order = []
    const queue = new OperationQueue()

    const first = queue.enqueue({
      kind: 'load',
      epoch: 1,
      run: async () => {
        order.push('load:start')
        await Promise.resolve()
        order.push('load:end')
      }
    })
    const second = queue.enqueue({
      kind: 'play',
      epoch: 1,
      run: async () => {
        order.push('play')
      }
    })

    await Promise.all([first, second])

    expect(order).toEqual(['load:start', 'load:end', 'play'])
  })

  it('supersedes only pending seeks from the same source epoch', async () => {
    const queue = new OperationQueue()
    let releaseLoad
    const blockingLoad = queue.enqueue({
      kind: 'load',
      epoch: 1,
      run: () => new Promise((resolve) => {
        releaseLoad = resolve
      })
    })

    const oldSeek = queue.enqueue({ kind: 'seek', epoch: 1, run: () => 10 })
    const oldSeekResult = oldSeek.catch((error) => error)
    const otherSourceSeek = queue.enqueue({
      kind: 'seek',
      epoch: 2,
      run: () => 30
    })
    const newSeek = queue.enqueue({ kind: 'seek', epoch: 1, run: () => 20 })

    releaseLoad()
    await blockingLoad

    expect(await oldSeekResult).toMatchObject({ code: 'OPERATION_SUPERSEDED' })
    await expect(otherSourceSeek).resolves.toBe(30)
    await expect(newSeek).resolves.toBe(20)
  })

  it('clears matching pending operations without interrupting the running one', async () => {
    const queue = new OperationQueue()
    let releaseLoad
    const blockingLoad = queue.enqueue({
      kind: 'load',
      epoch: 1,
      run: () => new Promise((resolve) => {
        releaseLoad = resolve
      })
    })
    const oldSource = queue.enqueue({ kind: 'play', epoch: 1, run: () => 'old' })
    const oldSourceResult = oldSource.catch((error) => error)
    const currentSource = queue.enqueue({
      kind: 'play',
      epoch: 2,
      run: () => 'current'
    })

    queue.clear(
      (operation) => operation.epoch === 1,
      new PlayerError('SOURCE_CHANGED', 'Source changed')
    )
    expect(await oldSourceResult).toMatchObject({ code: 'SOURCE_CHANGED' })
    releaseLoad()
    await blockingLoad

    await expect(currentSource).resolves.toBe('current')
  })

  it('rejects pending and future operations after destruction', async () => {
    const queue = new OperationQueue()
    let releaseLoad
    const blockingLoad = queue.enqueue({
      kind: 'load',
      epoch: 1,
      run: () => new Promise((resolve) => {
        releaseLoad = resolve
      })
    })
    const pending = queue.enqueue({ kind: 'play', epoch: 1, run: () => 'play' })
    const pendingResult = pending.catch((error) => error)

    queue.destroy()

    expect(await pendingResult).toMatchObject({ code: 'PLAYER_DESTROYED' })
    await expect(queue.enqueue({ kind: 'pause', epoch: 1, run: () => 'pause' }))
      .rejects.toMatchObject({ code: 'PLAYER_DESTROYED' })

    releaseLoad()
    await blockingLoad
  })
})
