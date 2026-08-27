# libmedia-avp-vue3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个可由纯 JavaScript Vue 3 + Vite 项目消费的 libmedia 播放器库，同时提供完整播放器、无 UI 内核、组合式 API 和运行时资源插件。

**Architecture:** 使用固定版本 `@libmedia/avplayer@1.3.1` 的预编译 ESM 运行时，所有引擎调用集中到 `PlayerController` 并通过 `OperationQueue` 串行化。Vue 层只处理生命周期和响应式桥接；Vite 插件负责开发/生产环境中的动态 chunk、manifest 和 WASM 资源交付。

**Tech Stack:** Vue 3、JavaScript ESM、Vite 5/6/7、Vitest、Vue Test Utils、happy-dom、Playwright、`@libmedia/avplayer@1.3.1`

**Spec:** `docs/superpowers/specs/2026-08-27-libmedia-avp-vue3-design.md`

## Global Constraints

- 所有新增和修改只能位于 `D:\repo\github.com\airplayTV\libmedia-avp-vue3`。
- 不得修改相邻项目 `D:\repo\github.com\airplayTV\libmedia-avp`。
- 源码使用 JavaScript 和 Vue SFC；消费 fixture 不得存在 `tsconfig.json` 或 `<script lang="ts">`。
- 文件编码统一为 UTF-8 无 BOM。
- 固定使用 `@libmedia/avplayer@1.3.1`，对应 npm `gitHead` 为 `152f629d3021fd8013efa464fcb7b55f9fbe7753`。
- Vue 是 `peerDependency`，不得打包第二份 Vue。
- 首版正式支持 Vite 5、6、7，不声明 Webpack 和纯 `<script>` 支持。
- 公共时间单位统一为秒；AVPlayer 边界统一转换为毫秒 `BigInt`。
- 不公开原始 AVPlayer 实例，不允许绕过 `PlayerController` 和 `OperationQueue`。
- 不包含 x264/x265 编码器、转码、播放历史、广告、投屏和选集业务。
- 每个生产行为先写失败测试并确认失败原因，再写最小实现。
- 每个任务完成后只提交本任务文件；不推送、不发布 npm。

---

## File Map

### Package and build

- `package.json`：包入口、依赖、脚本和发布白名单。
- `vite.lib.config.js`：组件库 ESM/CJS 构建。
- `vite.plugin.config.js`：Vite 插件 ESM/CJS 构建。
- `vitest.config.js`：单元与组件测试环境。
- `src/index.js`：公共运行时入口。
- `src/index.d.ts`：公共类型声明。
- `vite/index.js`：`libmediaAssets()` 插件入口。
- `vite/index.d.ts`：插件类型声明。

### Core

- `src/core/player-state.js`：稳定字符串状态和转换规则。
- `src/core/player-error.js`：稳定错误类型和归一化。
- `src/core/time.js`：秒与毫秒 `BigInt` 转换。
- `src/core/operation-queue.js`：异步命令串行、合并与取消。
- `src/core/source-epoch.js`：源世代标记与过期结果判断。
- `src/core/codec-map.js`：codec ID 到资源名称的唯一映射。
- `src/core/asset-manifest.js`：manifest 解析和版本校验。
- `src/core/wasm-capabilities.js`：baseline/SIMD/atomic 能力选择。
- `src/core/asset-resolver.js`：运行时和 WASM URL 解析。
- `src/core/engine-loader.js`：AVPlayer ESM 运行时加载与共享缓存。
- `src/core/player-controller.js`：播放器状态机、事件和公开命令。

### Vue integration and UI

- `src/composables/use-libmedia-player.js`：Vue 响应式桥接。
- `src/components/LibmediaPlayerCore.vue`：无 UI 组件。
- `src/components/LibmediaPlayer.vue`：完整播放器。
- `src/ui/PlayerControls.vue`：底部控制栏。
- `src/ui/PlayerProgress.vue`：可访问进度条。
- `src/ui/PlayerSettings.vue`：倍速和轨道设置。
- `src/ui/PlayerStatusOverlay.vue`：poster、loading、错误和自动播放提示。
- `src/ui/icons.js`：无依赖 SVG 图标组件。
- `src/style.css`：组件作用域类名和公共 CSS 变量。

### Runtime assets and verification

- `scripts/sync-libmedia-assets.mjs`：从固定 npm 包和固定 Git commit 同步资源并计算 SHA-256。
- `scripts/copy-types.mjs`：将人工维护并经测试的声明文件复制到发布目录。
- `scripts/test-vite-matrix.mjs`：用固定 Vite 5/6/7 版本构建真实 JavaScript fixture。
- `runtime-assets/manifest.json`：运行时、预设、codec 和完整性清单。
- `runtime-assets/runtime/*`：AVPlayer ESM 主文件和动态 chunk。
- `runtime-assets/wasm/*`：允许发布的解码、重采样和倍速 WASM。
- `tests/fixtures/vue-js-consumer/*`：真实 JavaScript Vue 消费项目。
- `tests/browser/*`：Playwright 浏览器验收。
- `tests/fixtures/media/*`：本地可重复测试媒体。
- `playground/*`：人工验收页面。
- `README.md`、`LICENSE`、`THIRD_PARTY_LICENSES.md`：使用和许可证文档。

---

### Task 1: Scaffold a publishable JavaScript Vue library

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `vite.lib.config.js`
- Create: `vitest.config.js`
- Create: `src/index.js`
- Test: `tests/unit/public-entry.test.js`

**Interfaces:**
- Produces: `LIBMEDIA_AVP_VERSION: string`
- Produces: npm scripts `test`, `test:run`, `build`, `build:lib`, `build:plugin`, `pack:check`

- [ ] **Step 1: Create package metadata and test tooling**

Use this dependency boundary in `package.json`:

```json
{
  "name": "libmedia-avp-vue3",
  "version": "0.1.0",
  "private": true,
  "license": "UNLICENSED",
  "type": "module",
  "sideEffects": ["**/*.css"],
  "files": ["dist", "runtime-assets", "README.md", "LICENSE", "THIRD_PARTY_LICENSES.md"],
  "peerDependencies": { "vue": ">=3.3.0 <4" },
  "dependencies": { "@libmedia/avplayer": "1.3.1" },
  "devDependencies": {
    "@playwright/test": "^1.55.0",
    "@vitejs/plugin-vue": "^6.0.1",
    "@vue/test-utils": "^2.4.6",
    "happy-dom": "^18.0.1",
    "typescript": "^5.9.2",
    "vite": "^7.1.0",
    "vitest": "^3.2.4",
    "vue": "^3.5.18"
  },
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "build:lib": "vite build --config vite.lib.config.js",
    "build:plugin": "vite build --config vite.plugin.config.js",
    "build": "npm run build:lib && npm run build:plugin",
    "pack:check": "npm pack --dry-run"
  }
}
```

Configure `vite.lib.config.js` with Vue externalized and two formats:

```js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: 'src/index.js',
      name: 'LibmediaAvpVue3',
      formats: ['es', 'cjs'],
      fileName: (format) => format === 'es' ? 'index.js' : 'index.cjs'
    },
    rollupOptions: {
      external: ['vue'],
      output: { globals: { vue: 'Vue' } }
    },
    cssFileName: 'style'
  }
})
```

Configure `vitest.config.js` without a TypeScript config:

```js
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.js'],
    clearMocks: true,
    restoreMocks: true
  }
})
```

- [ ] **Step 2: Install dependencies and create the lockfile**

Run: `npm install`

Expected: exit code `0`, `package-lock.json` created, exact `@libmedia/avplayer` resolves to `1.3.1`.

- [ ] **Step 3: Write the failing public-entry test**

```js
import { describe, expect, it } from 'vitest'
import { LIBMEDIA_AVP_VERSION } from '../../src/index.js'

describe('public entry', () => {
  it('exports the library version as a stable string', () => {
    expect(LIBMEDIA_AVP_VERSION).toBe('0.1.0')
  })
})
```

- [ ] **Step 4: Run the test and confirm RED**

Run: `npm run test:run -- tests/unit/public-entry.test.js`

Expected: FAIL because `src/index.js` or `LIBMEDIA_AVP_VERSION` does not exist.

- [ ] **Step 5: Add the minimal public entry**

```js
export const LIBMEDIA_AVP_VERSION = '0.1.0'
```

- [ ] **Step 6: Run tests and the initial build**

Run: `npm run test:run -- tests/unit/public-entry.test.js`

Expected: `1 passed`.

Run: `npm run build:lib`

Expected: exit code `0`; `dist/index.js`, `dist/index.cjs` exist and Vue is not bundled.

- [ ] **Step 7: Commit**

```bash
git add .gitignore package.json package-lock.json vite.lib.config.js vitest.config.js src/index.js tests/unit/public-entry.test.js
git commit -m "chore: scaffold Vue player library"
```

---

### Task 2: Define stable state, time, and error contracts

**Files:**
- Create: `src/core/player-state.js`
- Create: `src/core/time.js`
- Create: `src/core/player-error.js`
- Modify: `src/index.js`
- Test: `tests/unit/player-state.test.js`
- Test: `tests/unit/time.test.js`
- Test: `tests/unit/player-error.test.js`

**Interfaces:**
- Produces: `PlayerState`, `canTransition(from, to): boolean`
- Produces: `secondsToEngineTime(seconds): bigint`, `engineTimeToSeconds(value): number`
- Produces: `PlayerError`, `normalizePlayerError(error, context): PlayerError`

- [ ] **Step 1: Write failing tests for state transitions and time conversion**

```js
expect(canTransition(PlayerState.IDLE, PlayerState.LOADING)).toBe(true)
expect(canTransition(PlayerState.DESTROYED, PlayerState.LOADING)).toBe(false)
expect(secondsToEngineTime(1.234)).toBe(1234n)
expect(engineTimeToSeconds(2500n)).toBe(2.5)
expect(() => secondsToEngineTime(-1)).toThrow('INVALID_TIME')
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `npm run test:run -- tests/unit/player-state.test.js tests/unit/time.test.js`

Expected: FAIL because the modules are missing.

- [ ] **Step 3: Implement the state and time modules**

Use frozen string states and an explicit transition map. Implement time conversion as:

```js
export function secondsToEngineTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new PlayerError('INVALID_TIME', 'Time must be a non-negative finite number')
  }
  return BigInt(Math.round(seconds * 1000))
}

export function engineTimeToSeconds(value) {
  return Number(value) / 1000
}
```

- [ ] **Step 4: Write the failing error-normalization test**

```js
const cause = new Error('fetch failed')
const error = normalizePlayerError(cause, {
  code: 'WASM_LOAD_FAILED',
  source: 'https://media.example/video.mp4',
  recoverable: true
})

expect(error).toMatchObject({
  name: 'PlayerError',
  code: 'WASM_LOAD_FAILED',
  recoverable: true
})
expect(error.cause).toBe(cause)
expect(error.toPublicJSON()).not.toHaveProperty('cause')
expect(error.toPublicJSON()).not.toHaveProperty('source')
```

- [ ] **Step 5: Run the error test and confirm RED**

Run: `npm run test:run -- tests/unit/player-error.test.js`

Expected: FAIL because `PlayerError` is missing.

- [ ] **Step 6: Implement and export stable errors**

`PlayerError` must preserve `cause` internally and expose a sanitized `toPublicJSON()` containing only `code`, `message`, `recoverable`, `requiresUserGesture` and safe `details`.

- [ ] **Step 7: Run all task tests**

Run: `npm run test:run -- tests/unit/player-state.test.js tests/unit/time.test.js tests/unit/player-error.test.js`

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/core/player-state.js src/core/time.js src/core/player-error.js src/index.js tests/unit/player-state.test.js tests/unit/time.test.js tests/unit/player-error.test.js
git commit -m "feat: define player state and error contracts"
```

---

### Task 3: Serialize commands and isolate source generations

**Files:**
- Create: `src/core/operation-queue.js`
- Create: `src/core/source-epoch.js`
- Test: `tests/unit/operation-queue.test.js`
- Test: `tests/unit/source-epoch.test.js`

**Interfaces:**
- Produces: `new OperationQueue()`
- Produces: `enqueue({ kind, epoch, run }): Promise<unknown>`
- Produces: `clear(predicate, error): void`, `destroy(error): void`
- Produces: `new SourceEpoch()`, `next(): number`, `current: number`, `isCurrent(epoch): boolean`

- [ ] **Step 1: Write a failing test proving strict serialization**

```js
const order = []
const queue = new OperationQueue()

const first = queue.enqueue({
  kind: 'load', epoch: 1,
  run: async () => { order.push('load:start'); await Promise.resolve(); order.push('load:end') }
})
const second = queue.enqueue({
  kind: 'play', epoch: 1,
  run: async () => { order.push('play') }
})

await Promise.all([first, second])
expect(order).toEqual(['load:start', 'load:end', 'play'])
```

- [ ] **Step 2: Run the queue test and confirm RED**

Run: `npm run test:run -- tests/unit/operation-queue.test.js`

Expected: FAIL because `OperationQueue` is missing.

- [ ] **Step 3: Implement the minimal FIFO queue**

Store pending records with their own resolve/reject functions. A single private `drain()` loop awaits each `run()` before starting the next record.

- [ ] **Step 4: Add failing tests for seek coalescing and cancellation**

```js
let releaseLoad
const blockingLoad = queue.enqueue({
  kind: 'load',
  epoch: 1,
  run: () => new Promise((resolve) => { releaseLoad = resolve })
})
await Promise.resolve()

const oldSeek = queue.enqueue({ kind: 'seek', epoch: 1, run: () => 10 })
const newSeek = queue.enqueue({ kind: 'seek', epoch: 1, run: () => 20 })
await expect(oldSeek).rejects.toMatchObject({ code: 'OPERATION_SUPERSEDED' })
releaseLoad()
await blockingLoad
await expect(newSeek).resolves.toBe(20)

queue.clear((item) => item.epoch === 1, new PlayerError('SOURCE_CHANGED', 'Source changed'))
```

- [ ] **Step 5: Implement pending-seek replacement and clear/destroy**

Only coalesce pending `seek` records with the same epoch; never discard a currently running seek. `destroy()` rejects all pending records and rejects every future `enqueue()` with `PLAYER_DESTROYED`.

- [ ] **Step 6: Add and satisfy source-epoch tests**

```js
const epoch = new SourceEpoch()
expect(epoch.current).toBe(0)
expect(epoch.next()).toBe(1)
expect(epoch.isCurrent(1)).toBe(true)
expect(epoch.isCurrent(0)).toBe(false)
```

- [ ] **Step 7: Run task tests**

Run: `npm run test:run -- tests/unit/operation-queue.test.js tests/unit/source-epoch.test.js`

Expected: all tests pass with no unhandled rejection.

- [ ] **Step 8: Commit**

```bash
git add src/core/operation-queue.js src/core/source-epoch.js tests/unit/operation-queue.test.js tests/unit/source-epoch.test.js
git commit -m "feat: serialize player operations"
```

---

### Task 4: Resolve versioned runtime and WASM assets

**Files:**
- Create: `src/core/codec-map.js`
- Create: `src/core/asset-manifest.js`
- Create: `src/core/wasm-capabilities.js`
- Create: `src/core/asset-resolver.js`
- Test: `tests/unit/asset-manifest.test.js`
- Test: `tests/unit/wasm-capabilities.test.js`
- Test: `tests/unit/asset-resolver.test.js`

**Interfaces:**
- Produces: `LIBMEDIA_VERSION = '1.3.1'`
- Produces: `getCodecResource(codecId): string | null`
- Produces: `parseAssetManifest(value): AssetManifest`
- Produces: `selectWasmVariant(options): 'atomic' | 'simd' | 'baseline'`
- Produces: `createAssetResolver({ baseUrl, manifest, capabilities, requestedVariant })`

- [ ] **Step 1: Write failing manifest validation tests**

```js
expect(() => parseAssetManifest({ avplayerVersion: '1.2.0' }))
  .toThrowError(expect.objectContaining({ code: 'RUNTIME_VERSION_MISMATCH' }))

expect(parseAssetManifest({
  schemaVersion: 1,
  avplayerVersion: '1.3.1',
  upstreamCommit: '152f629d3021fd8013efa464fcb7b55f9fbe7753',
  preset: 'standard',
  variants: ['baseline', 'simd'],
  files: {}
}).avplayerVersion).toBe('1.3.1')
```

- [ ] **Step 2: Run manifest tests and confirm RED**

Run: `npm run test:run -- tests/unit/asset-manifest.test.js`

Expected: FAIL because manifest parsing is missing.

- [ ] **Step 3: Implement strict manifest parsing**

Reject non-object input, schema versions other than `1`, AVPlayer versions other than `1.3.1`, missing upstream commit, unknown variants and non-object `files`.

- [ ] **Step 4: Write capability-selection tests**

```js
expect(selectWasmVariant({ requested: 'auto', simd: true, atomic: false, available: ['baseline', 'simd'] })).toBe('simd')
expect(selectWasmVariant({ requested: 'auto', simd: false, atomic: false, available: ['baseline', 'simd'] })).toBe('baseline')
expect(selectWasmVariant({ requested: 'atomic', simd: true, atomic: false, available: ['baseline', 'simd', 'atomic'] })).toBe('simd')
```

- [ ] **Step 5: Implement capability selection**

Use dependency-injected booleans in `selectWasmVariant`. Keep browser probing in `detectWasmCapabilities(globalObject)` so selection tests do not depend on the test runtime. Atomic is available only when `crossOriginIsolated === true`, `SharedArrayBuffer` exists and WebAssembly threads validation succeeds.

- [ ] **Step 6: Write resolver tests for decoder, resampler and missing codec**

```js
expect(resolver.getWasm('decoder', 27)).toBe('/assets/libmedia-avp/wasm/simd/h264.wasm')
expect(resolver.getWasm('resampler')).toBe('/assets/libmedia-avp/wasm/simd/resample.wasm')
expect(() => resolver.getWasm('decoder', 173)).toThrowError(expect.objectContaining({ code: 'CODEC_NOT_INCLUDED' }))
```

- [ ] **Step 7: Implement codec mapping and resolver**

The standard map must include the exact codec IDs documented in the approved spec and upstream enums: H.264 `27`, HEVC `173`, AV1 `225`, VP8 `139`, VP9 `167`, MPEG-2 `2`, MPEG-4 `12`, MJPEG `7`, AAC `86018`, MP3 `86017`, Opus `86076`, Vorbis `86021`, FLAC `86028`, AC3 `86019`, EAC3 `86056`, DTS `86020`.

Build URLs with `new URL(relativePath, normalizedBaseUrl).href`; never concatenate untrusted paths.

- [ ] **Step 8: Run task tests**

Run: `npm run test:run -- tests/unit/asset-manifest.test.js tests/unit/wasm-capabilities.test.js tests/unit/asset-resolver.test.js`

Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/core/codec-map.js src/core/asset-manifest.js src/core/wasm-capabilities.js src/core/asset-resolver.js tests/unit/asset-manifest.test.js tests/unit/wasm-capabilities.test.js tests/unit/asset-resolver.test.js
git commit -m "feat: resolve versioned libmedia assets"
```

---

### Task 5: Load the engine once and implement PlayerController

**Files:**
- Create: `src/core/engine-loader.js`
- Create: `src/core/player-controller.js`
- Modify: `src/index.js`
- Test: `tests/unit/engine-loader.test.js`
- Test: `tests/unit/player-controller.test.js`
- Create: `tests/helpers/fake-engine.js`

**Interfaces:**
- Produces: `loadAvPlayerRuntime({ runtimeUrl, importer }): Promise<AVPlayerConstructor>`
- Produces: `new PlayerController({ container, source, engineOptions, loadOptions, assetResolver, createEngine, retryPolicy, onEvent })`
- Produces public controller commands `load`, `play`, `pause`, `stop`, `seek`, `setVolume`, `mute`, `unmute`, `setPlaybackRate`, `getVideoList`, `getAudioList`, `getSubtitleList`, `selectVideo`, `selectAudio`, `selectSubtitle`, `enterFullscreen`, `exitFullscreen`, `getStats`, `destroy`
- Produces internal render command `resize(width, height)` for the headless component; it is not part of the component-ref contract

- [ ] **Step 1: Write a failing engine-loader cache test**

```js
let imports = 0
const importer = async () => { imports += 1; return { default: class AVPlayer {} } }
const first = await loadAvPlayerRuntime({ runtimeUrl: '/runtime/avplayer.js', importer })
const second = await loadAvPlayerRuntime({ runtimeUrl: '/runtime/avplayer.js', importer })
expect(first).toBe(second)
expect(imports).toBe(1)
```

- [ ] **Step 2: Run loader test and confirm RED**

Run: `npm run test:run -- tests/unit/engine-loader.test.js`

Expected: FAIL because the loader is missing.

- [ ] **Step 3: Implement URL-keyed promise caching**

Default importer must be:

```js
const defaultImporter = (url) => import(/* @vite-ignore */ url)
```

Delete a failed promise from the cache so a user retry can perform a real new import. Reject modules without a default constructor as `RUNTIME_LOAD_FAILED`.

- [ ] **Step 4: Create a real-behavior fake engine and failing controller tests**

`tests/helpers/fake-engine.js` must implement its own event emitter and record actual call order:

```js
export class FakeEngine {
  calls = []
  listeners = new Map()
  duration = 120000n
  status = 0
  on(name, listener) { /* store listener */ }
  off(name, listener) { /* remove listener */ }
  emit(name, payload) { /* call current listeners */ }
  async load(source, options) { this.calls.push(['load', source, options]); this.emit('loaded') }
  async play() { this.calls.push(['play']); this.emit('playing') }
  async pause() { this.calls.push(['pause']); this.emit('paused') }
  async seek(value) { this.calls.push(['seek', value]); this.emit('time', value) }
  async stop() { this.calls.push(['stop']) }
  setVolume(value) { this.calls.push(['volume', value]) }
  setPlaybackRate(value) { this.calls.push(['rate', value]) }
  resize(width, height) { this.calls.push(['resize', width, height]) }
  async getVideoList() { return [{ id: 0, codec: 'h264' }] }
  async getAudioList() { return [{ id: 1, codec: 'aac' }] }
  async getSubtitleList() { return [{ id: 2, language: 'zh' }] }
  async selectVideo(id, smooth) { this.calls.push(['video', id, smooth]) }
  async selectAudio(id, smooth) { this.calls.push(['audio', id, smooth]) }
  async selectSubtitle(id) { this.calls.push(['subtitle', id]) }
  getDuration() { return this.duration }
  getStats() { return { videoCodec: 'h264' } }
}
```

Test command order, seconds conversion, public events, and `sourceEpoch`:

```js
await controller.load('a.mp4')
await controller.seek(1.25)
await controller.play()
expect(engine.calls).toEqual([
  ['load', 'a.mp4', {}],
  ['seek', 1250n],
  ['play']
])
```

- [ ] **Step 5: Run controller tests and confirm RED**

Run: `npm run test:run -- tests/unit/player-controller.test.js`

Expected: FAIL because `PlayerController` is missing.

- [ ] **Step 6: Implement minimal controller creation, events and commands**

Instantiate the engine lazily on first `load`. For every new source epoch, remove the previous event listeners and bind new closures that capture the current epoch; each closure must discard callbacks when `sourceEpoch.isCurrent(capturedEpoch)` is false. Convert `time` and duration values to seconds before emitting. Clamp the public volume contract to `[0, 1]` and pass the normalized value unchanged to AVPlayer. Reject missing source with `INVALID_SOURCE`. Do not expose the engine.

- [ ] **Step 7: Add failing tests for retries, autoplay blocking, source changes and destroy**

Use retry delays `[500, 1500]` through an injected `sleep(ms)` function. Assert unsupported codec and `AUTOPLAY_BLOCKED` do not retry. Before loading source B, retain a source-A listener function from the fake engine; invoke that retained function after source B becomes current and assert it cannot change source-B state. Assert `destroy()` unbinds listeners and future calls reject with `PLAYER_DESTROYED`.

Also test controller delegation for playback rate, the three asynchronous track-list methods, the three track-selection methods, and `resize`. Assert all calls are serialized through the same queue, except synchronous read-only `getStats()`.

- [ ] **Step 8: Implement recovery and cleanup**

Only retry normalized `MEDIA_TIMEOUT`, `MEDIA_LOAD_FAILED`, `WASM_LOAD_FAILED` and `RUNTIME_LOAD_FAILED` when `recoverable === true`. `destroy()` must destroy the queue even if engine `stop()` rejects, then emit `DESTROYED` exactly once.

- [ ] **Step 9: Run core tests**

Run: `npm run test:run -- tests/unit/engine-loader.test.js tests/unit/player-controller.test.js`

Expected: all tests pass and Vitest reports no unhandled errors.

- [ ] **Step 10: Commit**

```bash
git add src/core/engine-loader.js src/core/player-controller.js src/index.js tests/helpers/fake-engine.js tests/unit/engine-loader.test.js tests/unit/player-controller.test.js
git commit -m "feat: add libmedia player controller"
```

---

### Task 6: Add the Vue composable

**Files:**
- Create: `src/composables/use-libmedia-player.js`
- Modify: `src/index.js`
- Test: `tests/unit/use-libmedia-player.test.js`

**Interfaces:**
- Consumes: `PlayerController`
- Produces: `useLibmediaPlayer(options)` returning refs and stable command functions

- [ ] **Step 1: Write the failing composable test**

Mount a small harness component and inject `controllerFactory`. Assert the returned shape:

```js
expect(result).toMatchObject({
  containerRef: expect.any(Object),
  state: expect.any(Object),
  currentTime: expect.any(Object),
  duration: expect.any(Object),
  volume: expect.any(Object),
  muted: expect.any(Object),
  playbackRate: expect.any(Object),
  videoTracks: expect.any(Object),
  audioTracks: expect.any(Object),
  subtitleTracks: expect.any(Object),
  error: expect.any(Object),
  play: expect.any(Function),
  pause: expect.any(Function),
  seek: expect.any(Function),
  stop: expect.any(Function),
  setPlaybackRate: expect.any(Function),
  getVideoList: expect.any(Function),
  getAudioList: expect.any(Function),
  getSubtitleList: expect.any(Function),
  selectVideo: expect.any(Function),
  selectAudio: expect.any(Function),
  selectSubtitle: expect.any(Function),
  resize: expect.any(Function)
})
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `npm run test:run -- tests/unit/use-libmedia-player.test.js`

Expected: FAIL because the composable is missing.

- [ ] **Step 3: Implement the minimal reactive bridge**

Use `shallowRef` for controller, errors and track arrays; normal `ref` for scalar state including playback rate; `onMounted` for controller creation; `watch(() => unref(options.src), ...)` for source changes; and `onBeforeUnmount` for awaited cleanup started through a retained promise. Return stable wrappers for all controller commands required by a fully custom UI, including rate and track-list/selection commands.

- [ ] **Step 4: Add source-watch and unmount tests**

Assert that changing a source ref calls `controller.load(newSource)` once and unmount calls `controller.destroy()` once. Assert emitted `timeupdate` updates `currentTime` without replacing other refs.

- [ ] **Step 5: Run the composable test**

Run: `npm run test:run -- tests/unit/use-libmedia-player.test.js`

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/composables/use-libmedia-player.js src/index.js tests/unit/use-libmedia-player.test.js
git commit -m "feat: add Vue player composable"
```

---

### Task 7: Build the headless LibmediaPlayerCore component

**Files:**
- Create: `src/components/LibmediaPlayerCore.vue`
- Modify: `src/index.js`
- Test: `tests/components/LibmediaPlayerCore.test.js`

**Interfaces:**
- Consumes: `useLibmediaPlayer(options)`
- Produces: Vue component props/events/methods from the approved spec

- [ ] **Step 1: Write failing component contract tests**

```js
const wrapper = mount(LibmediaPlayerCore, {
  props: { src: 'movie.mp4', volume: 0.5 },
  global: { provide: { libmediaControllerFactory: factory } }
})

expect(wrapper.find('.libmedia-player-core').exists()).toBe(true)
expect(typeof wrapper.vm.play).toBe('function')
expect(typeof wrapper.vm.seek).toBe('function')
```

Assert all approved events are declared and forwarded with sanitized payloads.

- [ ] **Step 2: Run the component test and confirm RED**

Run: `npm run test:run -- tests/components/LibmediaPlayerCore.test.js`

Expected: FAIL because the component is missing.

- [ ] **Step 3: Implement the core component**

Use a single root with `tabindex="0"`, a dedicated render container ref, `ResizeObserver` cleanup, and `defineExpose` for only the approved component-ref methods. The observer calls the controller's internal `resize(width, height)` through the composable and coalesces redundant dimensions. Do not render buttons or import UI modules.

- [ ] **Step 4: Add props-change, multi-instance and cleanup tests**

Mount two components with separate controllers. Verify source and state never cross between them. Unmount one and verify only its controller is destroyed.

- [ ] **Step 5: Run the component suite**

Run: `npm run test:run -- tests/components/LibmediaPlayerCore.test.js`

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/LibmediaPlayerCore.vue src/index.js tests/components/LibmediaPlayerCore.test.js
git commit -m "feat: add headless Vue player component"
```

---

### Task 8: Build accessible controls and the full player

**Files:**
- Create: `src/ui/icons.js`
- Create: `src/ui/PlayerProgress.vue`
- Create: `src/ui/PlayerSettings.vue`
- Create: `src/ui/PlayerControls.vue`
- Create: `src/ui/PlayerStatusOverlay.vue`
- Create: `src/components/LibmediaPlayer.vue`
- Create: `src/style.css`
- Modify: `src/index.js`
- Test: `tests/components/PlayerProgress.test.js`
- Test: `tests/components/LibmediaPlayer.test.js`

**Interfaces:**
- Consumes: `LibmediaPlayerCore` public component methods and events
- Produces: complete player component and `style.css`

- [ ] **Step 1: Write failing accessible-progress tests**

```js
expect(wrapper.attributes('role')).toBe('slider')
expect(wrapper.attributes('aria-valuemin')).toBe('0')
expect(wrapper.attributes('aria-valuenow')).toBe('30')
expect(wrapper.attributes('aria-valuemax')).toBe('120')
await wrapper.trigger('keydown', { key: 'ArrowRight' })
expect(wrapper.emitted('seek')[0]).toEqual([35])
```

- [ ] **Step 2: Run the progress test and confirm RED**

Run: `npm run test:run -- tests/components/PlayerProgress.test.js`

Expected: FAIL because the progress component is missing.

- [ ] **Step 3: Implement progress dragging and keyboard behavior**

Clamp values to `[0, duration]`, emit preview values while dragging, and emit one final `seek` on pointer release. Prevent page scrolling only for keyboard events handled by the focused slider.

- [ ] **Step 4: Write failing full-player interaction tests**

Test native buttons, labels, slots, keyboard scope and control visibility:

```js
expect(wrapper.get('[aria-label="播放"]').element.tagName).toBe('BUTTON')
await wrapper.get('.libmedia-player').trigger('keydown', { key: 'k' })
expect(core.play).toHaveBeenCalledTimes(1)
await window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }))
expect(core.play).toHaveBeenCalledTimes(1)
```

Use fake timers to prove controls hide after 3000ms only while playing and remain visible while a control owns focus or settings are open.

- [ ] **Step 5: Run the full-player test and confirm RED**

Run: `npm run test:run -- tests/components/LibmediaPlayer.test.js`

Expected: FAIL because the full player is missing.

- [ ] **Step 6: Implement full controls, overlay and scoped styling**

Implement only approved controls. Fetch and refresh video/audio/subtitle track lists after `ready`, delegate selection through the composable commands, and keep playback-rate state synchronized with successful `setPlaybackRate` calls. SVG icons must inherit `currentColor`. Prefix all classes with `libmedia-`. Define the approved CSS variables and `prefers-reduced-motion` behavior in `src/style.css`.

- [ ] **Step 7: Add loading, error, autoplay and responsive tests**

Assert `loading`, `error` and `controls-extra` slots receive the documented slot props. Assert production error UI shows the stable code but never renders `cause.stack` or full `source` URL. Assert `AUTOPLAY_BLOCKED` renders a play action instead of a generic retry action.

- [ ] **Step 8: Run component tests**

Run: `npm run test:run -- tests/components/PlayerProgress.test.js tests/components/LibmediaPlayer.test.js`

Expected: all tests pass.

- [ ] **Step 9: Build and inspect CSS output**

Run: `npm run build:lib`

Expected: exit code `0`, `dist/style.css` exists, no UI framework appears in the dependency graph.

- [ ] **Step 10: Commit**

```bash
git add src/ui src/components/LibmediaPlayer.vue src/style.css src/index.js tests/components/PlayerProgress.test.js tests/components/LibmediaPlayer.test.js
git commit -m "feat: add accessible player controls"
```

---

### Task 9: Synchronize pinned libmedia runtime and decoder assets

**Files:**
- Create: `scripts/sync-libmedia-assets.mjs`
- Create: `scripts/libmedia-assets.json`
- Create: `runtime-assets/manifest.json`
- Create: `runtime-assets/runtime/*`
- Create: `runtime-assets/wasm/baseline/*`
- Create: `runtime-assets/wasm/simd/*`
- Create: `runtime-assets/wasm/atomic/*`
- Test: `tests/integration/sync-libmedia-assets.test.js`

**Interfaces:**
- Produces: command `npm run assets:sync`
- Produces: schema version `1` manifest with SHA-256 per file
- Consumes: npm package `node_modules/@libmedia/avplayer/dist/esm`
- Consumes: pinned upstream commit `152f629d3021fd8013efa464fcb7b55f9fbe7753`

- [ ] **Step 1: Write a failing sync test using a temporary fixture source**

Create temporary files `avplayer.js`, `123.avplayer.js` and `h264.wasm`, invoke the exported `syncAssets(options)`, then assert:

```js
expect(manifest).toMatchObject({
  schemaVersion: 1,
  avplayerVersion: '1.3.1',
  upstreamCommit: '152f629d3021fd8013efa464fcb7b55f9fbe7753'
})
expect(manifest.files['runtime/avplayer.js'].sha256).toMatch(/^[a-f0-9]{64}$/)
expect(manifest.files['runtime/123.avplayer.js'].sha256).toMatch(/^[a-f0-9]{64}$/)
```

- [ ] **Step 2: Run the sync test and confirm RED**

Run: `npm run test:run -- tests/integration/sync-libmedia-assets.test.js`

Expected: FAIL because the sync script is missing.

- [ ] **Step 3: Implement deterministic copying, downloading and hashing**

Use this exact decoder catalog in `scripts/libmedia-assets.json`:

```json
{
  "minimal": ["aac", "h264", "mp3"],
  "standard": [
    "aac", "ac3", "adpcm", "av1", "dca", "eac3", "flac", "h264",
    "hevc", "mjpeg", "mp3", "mpeg2video", "mpeg4", "opus", "pcm",
    "vorbis", "vp8", "vp9"
  ],
  "full": [
    "aac", "ac3", "adpcm", "av1", "bmp", "dca", "dvaudio", "dvvideo",
    "eac3", "flac", "gif", "h261", "h263", "h264", "hevc", "mjpeg",
    "mp3", "mpeg2video", "mpeg4", "msmpeg4", "opus", "pcm", "png",
    "ra", "rv", "speex", "theora", "tiff", "vorbis", "vp8", "vp9",
    "vvc", "webp", "wma", "wmv"
  ]
}
```

This list is derived from the baseline decoder files present in the pinned upstream commit. Resample and stretchpitch resources are mandatory shared assets and are stored outside the decoder preset arrays.

The script must:

1. Copy `avplayer.js` and `[0-9]*.avplayer.js` from the fixed npm package.
2. Read `scripts/libmedia-assets.json`, whose `minimal`, `standard` and `full` arrays contain explicit decoder module names; download only those named files from `https://raw.githubusercontent.com/zhaohappy/libmedia/152f629d3021fd8013efa464fcb7b55f9fbe7753/dist/`.
3. Reject redirects to a different host.
4. Reject non-2xx responses and zero-length payloads.
5. Write files to a temporary directory, hash them with SHA-256, then atomically replace `runtime-assets`.
6. Sort manifest keys so repeated runs are byte-for-byte stable.
7. Exclude every path containing `/encode/`, `x264` or `x265`.
8. Fail if `full` is not a strict superset of `standard`, or if `standard` is not a strict superset of `minimal`.
9. Fail if a catalog entry does not resolve to baseline, SIMD and atomic decoder assets at the pinned commit.

- [ ] **Step 4: Run the sync test and confirm GREEN**

Run: `npm run test:run -- tests/integration/sync-libmedia-assets.test.js`

Expected: all tests pass.

- [ ] **Step 5: Add the script and synchronize real assets**

Add:

```json
"assets:sync": "node scripts/sync-libmedia-assets.mjs"
```

Run: `npm run assets:sync`

Expected: exit code `0`; manifest records version `1.3.1`, the pinned commit and every emitted file hash; no encoder path exists.

- [ ] **Step 6: Verify deterministic output**

Run `npm run assets:sync` a second time, then run `git diff --exit-code -- runtime-assets`.

Expected: both commands exit `0` and the second sync produces no diff.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json scripts/sync-libmedia-assets.mjs scripts/libmedia-assets.json runtime-assets tests/integration/sync-libmedia-assets.test.js
git commit -m "build: pin libmedia runtime assets"
```

---

### Task 10: Implement the Vite runtime-assets plugin

**Files:**
- Create: `vite/index.js`
- Create: `vite/index.d.ts`
- Modify: `vite.plugin.config.js`
- Modify: `package.json`
- Create: `scripts/test-vite-matrix.mjs`
- Test: `tests/integration/vite-plugin.test.js`

**Interfaces:**
- Produces: `libmediaAssets(options = {}): import('vite').Plugin`
- Options: `preset`, `codecs`, `wasmVariants`, `threading`, `externalAssets`, `outputDir`

- [ ] **Step 1: Write a failing plugin config-validation test**

```js
expect(() => libmediaAssets({ preset: 'unknown' })).toThrow('INVALID_ASSET_PRESET')
expect(() => libmediaAssets({ wasmVariants: ['turbo'] })).toThrow('INVALID_WASM_VARIANT')
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `npm run test:run -- tests/integration/vite-plugin.test.js`

Expected: FAIL because `vite/index.js` is missing.

- [ ] **Step 3: Implement option validation and Vite hooks**

Use:

- `configureServer` to mount read-only middleware at `${base}assets/libmedia-avp/`.
- `generateBundle` and `this.emitFile({ type: 'asset', ... })` to emit selected runtime, manifest and WASM files.
- `config` to define `__LIBMEDIA_AVP_DEFAULT_BASE__` from Vite `base` and output directory.
- path resolution based on `import.meta.url`, never process CWD.

Runtime code must read the injected value safely:

```js
export function getDefaultAssetBase() {
  return typeof __LIBMEDIA_AVP_DEFAULT_BASE__ === 'string'
    ? __LIBMEDIA_AVP_DEFAULT_BASE__
    : '/assets/libmedia-avp/'
}
```

Block `..`, absolute paths and backslashes in configured output paths.

- [ ] **Step 4: Add production bundle tests**

Build a temporary Vite fixture with `base: '/app/'` and `preset: 'minimal'`, `codecs: ['h264', 'aac']`. Assert emitted files include only runtime, manifest, H.264, AAC, resample and stretchpitch resources under `assets/libmedia-avp/`.

Build again with `externalAssets: true`; assert no runtime/WASM asset is emitted.

- [ ] **Step 5: Run plugin tests**

Run: `npm run test:run -- tests/integration/vite-plugin.test.js`

Expected: all tests pass.

- [ ] **Step 6: Build the plugin entry**

Run: `npm run build:plugin`

Expected: ESM and CJS plugin files exist under `dist/vite/` and do not bundle `vite` itself.

- [ ] **Step 7: Verify Vite 5/6/7 consumers**

`scripts/test-vite-matrix.mjs` must create isolated copies of the JavaScript fixture and run these exact pairs:

```js
const matrix = [
  { vite: '5.4.19', pluginVue: '5.2.3' },
  { vite: '6.2.4', pluginVue: '5.2.3' },
  { vite: '7.1.0', pluginVue: '6.0.1' }
]
```

For each row, install the packed local tarball plus the fixed Vite/plugin versions, run `vite build`, and assert `dist/assets/libmedia-avp/manifest.json` exists. Add `"test:vite-matrix": "node scripts/test-vite-matrix.mjs"` and run `npm run test:vite-matrix`.

Expected: all three builds exit `0`.

- [ ] **Step 8: Commit**

```bash
git add vite/index.js vite/index.d.ts vite.plugin.config.js package.json scripts/test-vite-matrix.mjs tests/integration/vite-plugin.test.js
git commit -m "feat: add Vite libmedia assets plugin"
```

---

### Task 11: Publish declarations and verify a real JavaScript consumer tarball

**Files:**
- Create: `src/index.d.ts`
- Create: `scripts/copy-types.mjs`
- Modify: `package.json`
- Create: `tests/fixtures/vue-js-consumer/package.json`
- Create: `tests/fixtures/vue-js-consumer/index.html`
- Create: `tests/fixtures/vue-js-consumer/vite.config.js`
- Create: `tests/fixtures/vue-js-consumer/src/main.js`
- Create: `tests/fixtures/vue-js-consumer/src/App.vue`
- Create: `scripts/verify-package.mjs`
- Test: `tests/integration/package-consumer.test.js`

**Interfaces:**
- Produces public declaration contracts matching `src/index.js`
- Produces command `npm run verify:package`

- [ ] **Step 1: Write a failing package-consumer test**

The test must run `npm pack --json`, inspect the archive list, install the tarball into a copied fixture, and run the fixture build. Assert the fixture contains neither `tsconfig.json` nor `lang="ts"`.

- [ ] **Step 2: Run the test and confirm RED**

Run: `npm run test:run -- tests/integration/package-consumer.test.js`

Expected: FAIL because package exports, declarations or fixture are incomplete.

- [ ] **Step 3: Add public declarations matching the JavaScript API**

Define `PlayerSource = string | File | null`, `PlayerStateValue`, `PlayerPublicError`, normalized video/audio/subtitle track types, component prop/event types, the approved component-ref methods, the full composable command/result contract (including rate, track operations and `resize`), and Vite plugin options. Keep public time values in seconds and volume in `[0, 1]`. Do not export the raw AVPlayer type.

- [ ] **Step 4: Configure exact package exports**

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./style.css": "./dist/style.css",
    "./vite": {
      "types": "./dist/vite/index.d.ts",
      "import": "./dist/vite/index.js",
      "require": "./dist/vite/index.cjs"
    }
  }
}
```

Implement `scripts/copy-types.mjs` with `fs.copyFile` for `src/index.d.ts -> dist/index.d.ts` and `vite/index.d.ts -> dist/vite/index.d.ts`. Add `"build:types": "node scripts/copy-types.mjs"` and change `build` to `npm run build:lib && npm run build:plugin && npm run build:types`.

- [ ] **Step 5: Build the JavaScript fixture**

`App.vue` must import all three consumption surfaces without TypeScript:

```vue
<script setup>
import { ref } from 'vue'
import { LibmediaPlayer, LibmediaPlayerCore, useLibmediaPlayer } from 'libmedia-avp-vue3'
import 'libmedia-avp-vue3/style.css'

const source = ref(null)
const customPlayer = useLibmediaPlayer({ src: source })
</script>
```

Use `libmediaAssets({ preset: 'minimal', codecs: ['h264', 'aac'] })` in `vite.config.js`.

- [ ] **Step 6: Run package verification**

Run: `npm run build`

Run: `npm run verify:package`

Expected: both commands exit `0`; tarball contains only files permitted by `files`; fixture production build succeeds without TypeScript configuration.

- [ ] **Step 7: Run integration tests**

Run: `npm run test:run -- tests/integration/package-consumer.test.js`

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/index.d.ts package.json scripts/copy-types.mjs scripts/verify-package.mjs tests/fixtures/vue-js-consumer tests/integration/package-consumer.test.js
git commit -m "test: verify JavaScript package consumption"
```

---

### Task 12: Add playground, browser media fixtures, and Playwright smoke tests

**Files:**
- Create: `playground/package.json`
- Create: `playground/index.html`
- Create: `playground/vite.config.js`
- Create: `playground/src/main.js`
- Create: `playground/src/App.vue`
- Create: `playwright.config.js`
- Create: `tests/browser/player.spec.js`
- Create: `tests/fixtures/media/sample.mp4`
- Create: `tests/fixtures/media/hls/sample.m3u8`
- Create: `tests/fixtures/media/hls/segment-000.ts`
- Create: `tests/fixtures/media/hls/segment-001.ts`
- Create: `scripts/generate-test-media.ps1`

**Interfaces:**
- Produces commands `npm run playground:build`, `npm run test:browser`

- [ ] **Step 1: Generate deterministic, project-owned test media**

Use this PowerShell script command sequence with FFmpeg:

```powershell
ffmpeg -y -f lavfi -i "color=c=black:s=160x90:r=24:d=2" -f lavfi -i "sine=frequency=440:sample_rate=48000:duration=2" -c:v libx264 -pix_fmt yuv420p -profile:v baseline -c:a aac -b:a 64k -movflags +faststart tests/fixtures/media/sample.mp4
ffmpeg -y -i tests/fixtures/media/sample.mp4 -c copy -hls_time 1 -hls_list_size 0 -hls_segment_filename "tests/fixtures/media/hls/segment-%03d.ts" tests/fixtures/media/hls/sample.m3u8
```

The script must fail if FFmpeg exits non-zero and must print SHA-256 for every generated fixture. The encoder is used only to generate project-owned test data; no encoder binary or encoder WASM is distributed.

- [ ] **Step 2: Write failing Playwright tests**

Test in Chromium:

```js
await page.goto('/')
await page.getByRole('button', { name: '播放' }).click()
await expect(page.locator('[data-player-state]')).toHaveAttribute('data-player-state', 'playing')
await page.getByRole('slider', { name: '播放进度' }).press('ArrowRight')
await expect(page.locator('[data-current-time]')).not.toHaveText('0:00')
```

Add cases for HLS, `<input type="file">`, source switching, unmount cleanup and absence of `pageerror`/unhandled rejection.

- [ ] **Step 3: Run browser tests and confirm RED**

Run: `npm run test:browser -- --project=chromium`

Expected: FAIL because the playground or browser wiring is incomplete.

- [ ] **Step 4: Implement the playground**

Expose buttons for MP4, HLS, local File, source switch and conditional unmount. Render current state/time in stable `data-*` attributes used only by browser tests.

- [ ] **Step 5: Run Chromium browser tests**

Run: `npm run test:browser -- --project=chromium`

Expected: all MP4, HLS, local File, seek, switch and unmount tests pass.

- [ ] **Step 6: Run baseline fallback on Firefox and WebKit**

Run: `npm run test:browser -- --project=firefox --project=webkit`

Expected: baseline runtime loads and the smoke flow passes. If upstream libmedia has a browser-specific incompatibility, preserve the failing trace and report the exact browser/API error; do not replace this acceptance with Chromium results.

- [ ] **Step 7: Commit**

```bash
git add playground playwright.config.js tests/browser tests/fixtures/media scripts/generate-test-media.ps1 package.json package-lock.json
git commit -m "test: add browser playback smoke coverage"
```

---

### Task 13: Document usage, licenses, and operational requirements

**Files:**
- Create: `README.md`
- Create: `LICENSE`
- Create: `THIRD_PARTY_LICENSES.md`
- Create: `docs/troubleshooting.md`
- Create: `docs/cdn-deployment.md`
- Test: `tests/unit/documentation.test.js`

**Interfaces:**
- Produces copy-ready JavaScript installation and Vite configuration instructions

- [ ] **Step 1: Write failing documentation-content tests**

```js
expect(readme).toContain("import { libmediaAssets } from 'libmedia-avp-vue3/vite'")
expect(readme).toContain('<LibmediaPlayer')
expect(readme).toContain('LibmediaPlayerCore')
expect(readme).toContain('useLibmediaPlayer')
expect(readme).toContain('Cross-Origin-Opener-Policy')
expect(readme).not.toContain('@latest')
expect(licenses).toContain('LGPL-3.0-or-later')
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `npm run test:run -- tests/unit/documentation.test.js`

Expected: FAIL because documentation is missing.

- [ ] **Step 3: Write README and deployment documentation**

README must include:

- npm installation.
- JavaScript `vite.config.js`.
- Full component, core component and composable examples.
- Props, events and exposed methods.
- `minimal`, `standard`, `full` presets.
- `assetBaseUrl` fixed-version CDN example.
- COOP/COEP headers and fallback behavior.
- MIME, CORS and CORP requirements.
- Browser and real-device acceptance boundary.
- Error-code table and debugging steps.

- [ ] **Step 4: Add licenses and source-offer information**

Write `LICENSE` as an all-rights-reserved notice for the wrapper code, consistent with `package.json` value `UNLICENSED`; this prevents accidental public reuse until the user separately chooses a wrapper license. Record libmedia `LGPL-3.0-or-later`, version `1.3.1`, commit `152f629d3021fd8013efa464fcb7b55f9fbe7753`, repository URL, included decoder dependencies and source retrieval URL in `THIRD_PARTY_LICENSES.md`. Explicitly state that x264/x265 encoder assets are excluded.

- [ ] **Step 5: Run documentation tests**

Run: `npm run test:run -- tests/unit/documentation.test.js`

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add README.md LICENSE THIRD_PARTY_LICENSES.md docs/troubleshooting.md docs/cdn-deployment.md tests/unit/documentation.test.js
git commit -m "docs: add player usage and license guidance"
```

---

### Task 14: Execute the final verification matrix

**Files:**
- Modify only files required to fix a reproduced verification failure; every fix requires a failing regression test first.

**Interfaces:**
- Consumes all prior tasks.
- Produces a verified local package; does not publish or push.

- [ ] **Step 1: Verify the complete automated test suite**

Run: `npm run test:run`

Expected: exit code `0`, zero failed tests, zero unhandled errors.

- [ ] **Step 2: Verify production builds**

Run: `npm run build`

Expected: exit code `0`; ESM, CJS, CSS, types and Vite plugin outputs exist.

- [ ] **Step 3: Verify tarball content and JavaScript consumption**

Run: `npm run verify:package`

Expected: exit code `0`; JavaScript-only fixture installs the tarball and builds successfully.

- [ ] **Step 4: Verify the Vite compatibility matrix**

Run: `npm run test:vite-matrix`

Expected: fixed Vite `5.4.19`, `6.2.4` and `7.1.0` JavaScript consumers all build successfully.

- [ ] **Step 5: Verify asset integrity and exclusions**

Run: `npm run assets:sync`

Run: `git diff --exit-code -- runtime-assets`

Run: `rg -n -i "x264|x265|/encode/" runtime-assets`

Expected: sync and diff commands exit `0`; `rg` returns no matches.

- [ ] **Step 6: Verify browser playback**

Run: `npm run test:browser`

Expected: Chromium, Firefox and WebKit configured tests pass; any real upstream incompatibility remains explicitly reported with trace evidence rather than hidden.

- [ ] **Step 7: Verify encoding and project isolation**

Run a PowerShell check that fails if any tracked text file starts with UTF-8 BOM. Then run:

```powershell
git -c safe.directory=D:/repo/github.com/airplayTV/libmedia-avp -C ..\libmedia-avp status --short
```

Compare output with the recorded initial state:

```text
?? fdgsddgf.js
?? package-lock.json
?? public/avpxxxx/
?? src/components/avp-control.vue.dddd
?? src/components/avp2.vue
```

Expected: no new or modified path appears in `libmedia-avp`.

- [ ] **Step 8: Inspect final diff and package**

Run: `git status --short`

Run: `git diff --check`

Run: `npm pack --dry-run`

Expected: no unintended file, whitespace error, secret, media URL token or development-only asset is included.

- [ ] **Step 9: Commit verification-only fixes if any**

If verification required a code change, commit its regression test and fix together using a scoped message. If no file changed, do not create an empty commit.

Do not run `npm publish`, `git push`, create a release or modify another repository without a separate explicit user instruction.
