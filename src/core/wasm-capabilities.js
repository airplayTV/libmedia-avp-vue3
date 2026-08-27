import { PlayerError } from './player-error.js'

const SIMD_PROBE = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
  0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7b,
  0x03, 0x02, 0x01, 0x00,
  0x0a, 0x0a, 0x01, 0x08, 0x00, 0x41, 0x00, 0xfd, 0x0f, 0x0b
])

const THREADS_PROBE = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
  0x05, 0x04, 0x01, 0x03, 0x01, 0x01
])

function validates(webAssembly, bytes) {
  try {
    return typeof webAssembly?.validate === 'function' && webAssembly.validate(bytes)
  } catch {
    return false
  }
}

export function detectWasmCapabilities(globalObject = globalThis) {
  const simd = validates(globalObject.WebAssembly, SIMD_PROBE)
  const canUseSharedMemory = (
    globalObject.crossOriginIsolated === true &&
    typeof globalObject.SharedArrayBuffer === 'function'
  )
  const atomic = canUseSharedMemory && validates(
    globalObject.WebAssembly,
    THREADS_PROBE
  )

  return { simd, atomic }
}

export function selectWasmVariant({
  requested = 'auto',
  simd = false,
  atomic = false,
  available = []
}) {
  const availableVariants = new Set(available)
  const priorities = {
    auto: [
      ...(atomic ? ['atomic'] : []),
      ...(simd ? ['simd'] : []),
      'baseline'
    ],
    atomic: [
      ...(atomic ? ['atomic'] : []),
      ...(simd ? ['simd'] : []),
      'baseline'
    ],
    simd: [...(simd ? ['simd'] : []), 'baseline'],
    baseline: ['baseline']
  }

  if (!Object.hasOwn(priorities, requested)) {
    throw new PlayerError('WASM_UNSUPPORTED', 'Unknown WASM variant requested')
  }

  const selected = priorities[requested].find((variant) => (
    availableVariants.has(variant)
  ))

  if (!selected) {
    throw new PlayerError(
      'WASM_UNSUPPORTED',
      'No compatible WASM variant is available'
    )
  }

  return selected
}
