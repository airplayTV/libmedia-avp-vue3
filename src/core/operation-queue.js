import { PlayerError } from './player-error.js'

export class OperationQueue {
  #pending = []
  #draining = false
  #destroyedError = null

  enqueue(operation) {
    if (this.#destroyedError) {
      return Promise.reject(this.#destroyedError)
    }

    return new Promise((resolve, reject) => {
      if (operation.kind === 'seek') {
        this.clear(
          (pending) => (
            pending.kind === 'seek' && pending.epoch === operation.epoch
          ),
          new PlayerError(
            'OPERATION_SUPERSEDED',
            'A newer seek operation superseded this operation'
          )
        )
      }

      this.#pending.push({ ...operation, resolve, reject })
      void this.#drain()
    })
  }

  clear(predicate, error = new PlayerError(
    'OPERATION_CLEARED',
    'The pending operation was cleared'
  )) {
    const retained = []

    for (const operation of this.#pending) {
      if (predicate(operation)) {
        operation.reject(error)
      } else {
        retained.push(operation)
      }
    }

    this.#pending = retained
  }

  destroy(error = new PlayerError(
    'PLAYER_DESTROYED',
    'The player has been destroyed'
  )) {
    if (this.#destroyedError) {
      return
    }

    this.#destroyedError = error
    this.clear(() => true, error)
  }

  async #drain() {
    if (this.#draining) {
      return
    }

    this.#draining = true
    try {
      while (this.#pending.length > 0) {
        const operation = this.#pending.shift()
        try {
          operation.resolve(await operation.run())
        } catch (error) {
          operation.reject(error)
        }
      }
    } finally {
      this.#draining = false
    }
  }
}
