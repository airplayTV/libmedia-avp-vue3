import { PlayerError, normalizePlayerError } from './player-error.js'

const runtimePromises = new Map()

const defaultImporter = (url) => import(/* @vite-ignore */ url)

export function loadAvPlayerRuntime({ runtimeUrl, importer = defaultImporter }) {
  if (typeof runtimeUrl !== 'string' || runtimeUrl.trim() === '') {
    return Promise.reject(new PlayerError(
      'RUNTIME_LOAD_FAILED',
      'AVPlayer runtime URL must be a non-empty string'
    ))
  }

  if (runtimePromises.has(runtimeUrl)) {
    return runtimePromises.get(runtimeUrl)
  }

  const runtimePromise = Promise.resolve()
    .then(() => importer(runtimeUrl))
    .then((module) => {
      if (typeof module?.default !== 'function') {
        throw new PlayerError(
          'RUNTIME_LOAD_FAILED',
          'AVPlayer runtime does not export a default constructor'
        )
      }

      return module.default
    })
    .catch((error) => {
      runtimePromises.delete(runtimeUrl)
      if (error instanceof PlayerError) {
        throw error
      }

      throw normalizePlayerError(error, {
        code: 'RUNTIME_LOAD_FAILED',
        recoverable: true
      })
    })

  runtimePromises.set(runtimeUrl, runtimePromise)
  return runtimePromise
}
