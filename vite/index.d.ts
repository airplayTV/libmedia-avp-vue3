import type { Plugin } from 'vite'

export type LibmediaAssetPreset = 'minimal' | 'standard' | 'full'
export type LibmediaWasmVariant = 'baseline' | 'simd' | 'atomic'

export interface LibmediaAssetsOptions {
  preset?: LibmediaAssetPreset
  codecs?: string[]
  wasmVariants?: LibmediaWasmVariant[]
  threading?: boolean | 'auto'
  externalAssets?: boolean
  outputDir?: string
}

export declare function libmediaAssets(options?: LibmediaAssetsOptions): Plugin
export default libmediaAssets
