import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  LIBMEDIA_AVP_NAME,
  LIBMEDIA_AVP_REPOSITORY,
  LIBMEDIA_AVP_VERSION
} from '../../src/index.js'

const packageMetadata = JSON.parse(
  readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')
)

describe('public entry', () => {
  it('exports package metadata from one stable public contract', () => {
    expect(LIBMEDIA_AVP_NAME).toBe(packageMetadata.name)
    expect(LIBMEDIA_AVP_VERSION).toBe(packageMetadata.version)
    expect(LIBMEDIA_AVP_REPOSITORY).toBe(
      'https://github.com/airplayTV/libmedia-avp-vue3'
    )
  })
})
