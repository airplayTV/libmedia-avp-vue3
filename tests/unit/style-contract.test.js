import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const stylesheet = readFileSync(
  resolve(process.cwd(), 'src/style.css'),
  'utf8'
)

function declarationBlock(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return stylesheet.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? ''
}

describe('player visual contract', () => {
  it('keeps the video surface square while allowing overlays to use their own radius', () => {
    expect(declarationBlock('.libmedia-player')).toMatch(/border-radius:\s*0\s*;/)
  })
})
