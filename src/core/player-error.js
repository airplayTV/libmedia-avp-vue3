export class PlayerError extends Error {
  constructor(code, message, options = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause })
    this.name = 'PlayerError'
    this.code = code
    this.recoverable = options.recoverable === true
    this.requiresUserGesture = options.requiresUserGesture === true
    this.source = options.source
    this.details = options.details ?? {}
  }

  toPublicJSON() {
    return {
      code: this.code,
      message: this.message,
      recoverable: this.recoverable,
      requiresUserGesture: this.requiresUserGesture,
      details: sanitizeDetails(this.details)
    }
  }
}

const sensitiveDetailKey = /cause|source|url|uri|header|token|authorization|cookie|stack/i

function sanitizeDetails(value, seen = new WeakSet()) {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value
  }

  if (typeof value === 'bigint') {
    return value.toString()
  }

  if (typeof value !== 'object' || value instanceof Error || seen.has(value)) {
    return undefined
  }

  seen.add(value)

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeDetails(item, seen))
      .filter((item) => item !== undefined)
  }

  const sanitized = {}
  for (const [key, item] of Object.entries(value)) {
    if (sensitiveDetailKey.test(key)) {
      continue
    }

    const safeItem = sanitizeDetails(item, seen)
    if (safeItem !== undefined) {
      sanitized[key] = safeItem
    }
  }

  return sanitized
}

export function normalizePlayerError(error, context = {}) {
  if (error instanceof PlayerError && Object.keys(context).length === 0) {
    return error
  }

  const existing = error instanceof PlayerError ? error : undefined
  const message = context.message ?? error?.message ?? 'Player operation failed'

  return new PlayerError(
    context.code ?? existing?.code ?? 'MEDIA_LOAD_FAILED',
    message,
    {
      cause: existing?.cause ?? error,
      recoverable: context.recoverable ?? existing?.recoverable,
      requiresUserGesture:
        context.requiresUserGesture ?? existing?.requiresUserGesture,
      source: context.source ?? existing?.source,
      details: context.details ?? existing?.details
    }
  )
}
