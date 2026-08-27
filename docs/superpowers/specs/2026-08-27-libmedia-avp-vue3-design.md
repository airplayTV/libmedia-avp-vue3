# libmedia-avp-vue3 设计规格

- 日期：2026-08-27
- 状态：待用户审阅
- 项目目录：`D:\repo\github.com\airplayTV\libmedia-avp-vue3`
- 上游播放器：`@libmedia/avplayer` 官方预编译包

## 1. 目标

创建一个独立的 Vue 3 播放器组件库，对官方 `@libmedia/avplayer` 进行稳定封装，使不使用 TypeScript 的 Vue 3 项目也能直接调用。

库同时提供：

1. `LibmediaPlayer`：带完整通用控制栏的播放器组件。
2. `LibmediaPlayerCore`：不带控制栏的渲染组件。
3. `useLibmediaPlayer`：用于完全自定义界面的组合式 API。
4. `libmediaAssets`：面向 Vite 的运行时资源插件。

项目自身使用 JavaScript 和 Vue SFC 开发，发布 JavaScript 构建产物，并附带 TypeScript 声明文件。TypeScript 声明只用于增强类型提示，不构成消费端依赖。

## 2. 范围边界

### 2.1 纳入首版

- Vue 3。
- Vite 5、6、7。
- JavaScript 和 TypeScript 消费项目。
- HTTP/HTTPS 媒体 URL。
- HLS、DASH。
- libmedia 支持的常见媒体容器，包括 MP4、WebM、MKV、FLV、MPEG-TS 和 AVI。
- 浏览器本地 `File`。
- 本地运行时/WASM 资源默认交付。
- 通过 `assetBaseUrl` 使用自建 CDN。
- 响应式播放状态、稳定事件、异步命令队列和资源清理。
- 桌面和移动端响应式控制栏。

实际能否播放特定文件同时取决于容器内编码格式、浏览器能力和已包含的 WASM 解码器，不能仅依据文件扩展名承诺成功。

### 2.2 不纳入首版

- Webpack、Rollup 独立配置和纯 `<script>` 引入方式。
- RTSP、RTMP 代理服务及其端到端验收。
- 播放历史、选集、下一集、广告和投屏业务逻辑。
- x264/x265 编码器和任何转码功能。
- 全局快捷键。
- 双击快进、亮度手势和垂直音量手势。
- 暴露可绕过操作队列的原始 AVPlayer 实例。
- 修改现有 `D:\repo\github.com\airplayTV\libmedia-avp`。

## 3. 方案选择

采用官方预编译 `@libmedia/avplayer`，不直接编译 libmedia TypeScript 源码，也不依赖 `window.AVPlayer` 全局变量。

选择理由：

- 官方预编译包可直接被 JavaScript 项目使用。
- 避免把 libmedia 的 `cheap` 源码编译体系传递给消费项目。
- 将上游升级限制在播放器适配层和运行时资源清单内。
- 保持 Vue 生命周期、状态和 UI 与底层媒体引擎解耦。

首版锁定 `@libmedia/avplayer@1.3.1` 及同版本 libmedia 运行时资源；播放器运行时、动态 chunk、WASM 和 manifest 必须来自同一锁定版本。升级 libmedia 时必须同步升级整套资源并重新执行消费端和浏览器验证。

## 4. 总体架构

```text
LibmediaPlayer / LibmediaPlayerCore
                |
        useLibmediaPlayer
                |
         PlayerController
        /        |         \
OperationQueue  AssetResolver  ErrorNormalizer
        \        |         /
          EngineLoader
                |
      @libmedia/avplayer ESM
                |
   dynamic chunks + on-demand WASM
```

建议源码结构：

```text
libmedia-avp-vue3/
├─ src/
│  ├─ components/
│  │  ├─ LibmediaPlayer.vue
│  │  └─ LibmediaPlayerCore.vue
│  ├─ composables/
│  │  └─ useLibmediaPlayer.js
│  ├─ core/
│  │  ├─ player-controller.js
│  │  ├─ operation-queue.js
│  │  ├─ engine-loader.js
│  │  ├─ asset-resolver.js
│  │  ├─ wasm-capabilities.js
│  │  ├─ error-normalizer.js
│  │  └─ player-state.js
│  ├─ ui/
│  │  ├─ PlayerControls.vue
│  │  ├─ PlayerProgress.vue
│  │  ├─ PlayerSettings.vue
│  │  └─ icons/
│  └─ index.js
├─ vite/
│  └─ index.js
├─ runtime-assets/
├─ tests/
│  └─ fixtures/vue-js-consumer/
├─ playground/
└─ docs/
```

### 4.1 模块职责

- `PlayerController` 是唯一允许直接调用 AVPlayer 的模块。
- `OperationQueue` 串行化所有改变播放器状态的异步命令。
- `EngineLoader` 加载并缓存固定版本的 AVPlayer ESM 运行时。
- `AssetResolver` 校验 manifest，并根据 codec、媒体类型和浏览器能力选择 WASM。
- `useLibmediaPlayer` 将控制器状态转换为 Vue 响应式引用。
- Vue 组件只负责生命周期、Props/Events 桥接和界面。
- 多个播放器共享不可变运行时模块，但播放器实例、状态、队列和事件完全隔离。

## 5. 公共 API

### 5.1 组件

```js
import {
  LibmediaPlayer,
  LibmediaPlayerCore,
  useLibmediaPlayer,
  PlayerState
} from 'libmedia-avp-vue3'
```

完整组件示例：

```vue
<script setup>
import { ref } from 'vue'
import { LibmediaPlayer } from 'libmedia-avp-vue3'
import 'libmedia-avp-vue3/style.css'

const playerRef = ref(null)
const videoUrl = ref('https://example.com/video.m3u8')
</script>

<template>
  <LibmediaPlayer
    ref="playerRef"
    :src="videoUrl"
    :volume="0.8"
    asset-base-url="/assets/libmedia-avp/"
    @ended="onEnded"
    @error="onError"
  />
</template>
```

### 5.2 Props

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `src` | `string \| File \| null` | `null` | 网络地址或本地文件 |
| `autoplay` | `boolean` | `false` | 加载完成后尝试自动播放 |
| `muted` | `boolean` | `false` | 初始静音状态 |
| `volume` | `number` | `1` | `0` 到 `1` |
| `loop` | `boolean` | `false` | 循环播放 |
| `poster` | `string` | `''` | 封面地址 |
| `controls` | `boolean` | `true` | 完整组件是否显示控制栏 |
| `playsinline` | `boolean` | `true` | 移动端内联播放 |
| `assetBaseUrl` | `string` | 自动解析 | 运行时和 WASM 根地址 |
| `wasmVariant` | `auto \| simd \| atomic \| baseline` | `auto` | WASM 能力策略 |
| `loadOptions` | `object` | `{}` | 经过白名单限制的加载选项 |
| `engineOptions` | `object` | `{}` | 经过保护的 AVPlayer 高级配置 |

`engineOptions` 不能覆盖 `container`、`getWasm`、内部事件管理和操作队列。

### 5.3 实例方法

组件通过 `ref` 暴露：

```js
await player.load(source)
await player.play()
await player.pause()
await player.stop()
await player.seek(120.5)
await player.setVolume(0.5)
await player.mute()
await player.unmute()
await player.enterFullscreen()
await player.exitFullscreen()

const stats = player.getStats()
```

所有公共时间参数和事件值统一使用秒，允许小数。内部负责转换成 AVPlayer 使用的时间单位和 `BigInt`。所有改变状态的方法返回 `Promise`。

### 5.4 事件

- `loading`
- `ready`
- `play`
- `pause`
- `timeupdate`
- `durationchange`
- `seeking`
- `seeked`
- `ended`
- `volumechange`
- `statechange`
- `diagnostic`
- `error`

事件载荷是普通 JavaScript 对象，不直接暴露上游数字状态码或内部对象。

### 5.5 插槽

- `loading`
- `error`
- `controls-extra`

需要完全替换控制栏时使用 `LibmediaPlayerCore` 或 `useLibmediaPlayer`，而不是依赖不稳定的深层 UI 插槽。

## 6. 状态模型与并发

```js
const PlayerState = {
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  PLAYING: 'playing',
  PAUSED: 'paused',
  SEEKING: 'seeking',
  ENDED: 'ended',
  STOPPED: 'stopped',
  ERROR: 'error',
  DESTROYED: 'destroyed'
}
```

### 6.1 操作队列

- 同一时刻只执行一个 AVPlayer 异步操作。
- `load`、`play`、`pause`、`seek` 和 `stop` 进入同一命令队列。
- 连续多个尚未执行的 `seek` 只保留最后一个。
- `stop` 具有高优先级，可终止旧源加载或 seeking。
- 新 `src` 清除旧源尚未执行的命令。
- 销毁后的公开异步方法以 `PLAYER_DESTROYED` 拒绝。

### 6.2 源世代隔离

每次切换 `src` 增加 `sourceEpoch`。命令、异步结果和事件记录所属 epoch；非当前 epoch 的结果不得修改响应式状态。

```text
load(A) -> src changes -> stop(A) -> load(B)
   \ late event from A -> discarded
```

### 6.3 生命周期清理

组件卸载时：

1. 禁止接收新命令。
2. 清空未执行命令。
3. 停止 AVPlayer。
4. 解绑全部事件。
5. 撤销本地 `File` 的 Object URL。
6. 清理定时器和 `ResizeObserver`。
7. 释放 DOM、控制器和播放器引用。

## 7. 运行时资源

默认资源目录：

```text
assets/libmedia-avp/
├─ runtime/
│  ├─ avplayer.js
│  └─ *.avplayer.js
├─ wasm/
│  ├─ baseline/
│  ├─ simd/
│  └─ atomic/
└─ manifest.json
```

manifest 至少记录：

```json
{
  "runtimeVersion": "1.3.1",
  "avplayerVersion": "1.3.1",
  "preset": "standard",
  "codecs": ["h264", "hevc", "av1", "vp8", "vp9", "aac", "mp3"]
}
```

首版固定使用已确认发布的 `1.3.1`，不从网络读取 `latest`。

### 7.1 Vite 插件

```js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { libmediaAssets } from 'libmedia-avp-vue3/vite'

export default defineConfig({
  plugins: [
    vue(),
    libmediaAssets({
      preset: 'standard',
      wasmVariants: ['baseline', 'simd']
    })
  ]
})
```

插件在开发模式提供运行时静态资源，在生产构建中发射到稳定目录，并适配 Vite `base`。设置 `externalAssets: true` 时只执行配置和 manifest 校验，不复制本地 WASM。

### 7.2 WASM 预设

- `minimal`：调用方显式列出 codec，适合媒体格式完全可控的项目。
- `standard`：默认，包含 H.264、HEVC、AV1、VP8、VP9、MPEG-2、MPEG-4、MJPEG、AAC、MP3、Opus、Vorbis、FLAC、AC3、EAC3、DTS、重采样和倍速模块。
- `full`：包含上游提供的全部播放解码器，不包含编码器。

### 7.3 WASM 版本选择

默认 `auto` 按以下顺序选择：

1. 满足多线程配置和隔离响应头时选择 `atomic`。
2. 支持 SIMD 且资源存在时选择 `simd`。
3. 回退到 `baseline`。

多线程需要宿主顶层文档响应：

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

缺少隔离响应头时不直接失败，而是回退并发送一次 `diagnostic` 事件。

### 7.4 自建 CDN

`assetBaseUrl` 可以指向固定版本的自建 CDN 目录。该目录必须：

- 支持模块和 WASM 的跨域加载。
- 返回正确的 JavaScript 和 `application/wasm` MIME 类型。
- 配置必要的 CORS/CORP。
- 使用不可变版本目录，禁止覆盖现有版本。
- 保持 manifest、运行时、动态 chunk 和 WASM 版本一致。

## 8. UI 与交互

完整播放器采用无品牌绑定的深色现代界面，不依赖任何 UI 或图标库。图标使用组件内 SVG，样式不污染宿主全局 CSS。

### 8.1 控制项

- 播放/暂停。
- 当前时间/总时长。
- 拖动进度和缓冲进度。
- 音量/静音。
- 倍速。
- 音轨、字幕轨道和视频轨道选择。
- 全屏。
- 加载、错误和重试状态。

移动端隐藏次要文字，将音轨、字幕、倍速和视频轨道收纳到设置面板。

### 8.2 控制栏显隐

- 暂停、加载和错误状态始终显示。
- 播放状态无交互 3 秒后隐藏。
- 指针、触摸和键盘操作后显示。
- 控件获得焦点或设置面板打开时不隐藏。

### 8.3 键盘

播放器根节点获得焦点后支持：

- `Space`/`K`：播放或暂停。
- `Left`/`Right`：后退或前进 5 秒。
- `J`/`L`：后退或前进 10 秒。
- `Up`/`Down`：音量增减 5%。
- `M`：静音。
- `F`：全屏。
- `Esc`：关闭设置或退出全屏。

快捷键不注册到全局。

### 8.4 样式扩展

提供稳定 CSS 变量：

```css
.libmedia-player {
  --libmedia-accent: #3b82f6;
  --libmedia-text: #ffffff;
  --libmedia-surface: rgba(12, 18, 28, 0.86);
  --libmedia-radius: 10px;
}
```

### 8.5 无障碍

- 控件使用原生 `<button>`。
- 图标按钮带无障碍名称。
- 进度条提供 slider ARIA 语义。
- 所有操作可通过键盘完成。
- 保留清晰焦点样式。
- 支持 `prefers-reduced-motion`。
- 颜色对比度满足 WCAG AA。
- 状态提示使用节制的 `aria-live`，时间更新不频繁播报。

## 9. 错误与恢复

标准错误结构：

```js
{
  code: 'WASM_LOAD_FAILED',
  message: 'H.264 decoder resource failed to load',
  cause: originalError,
  recoverable: true,
  source: currentSource,
  details: {}
}
```

生产 UI 不显示完整 URL、请求头、堆栈或 `cause`。完整诊断信息只通过开发日志和 `diagnostic` 事件提供。

稳定错误码至少包括：

- `INVALID_SOURCE`
- `PLAYER_DESTROYED`
- `RUNTIME_LOAD_FAILED`
- `RUNTIME_VERSION_MISMATCH`
- `WASM_NOT_FOUND`
- `WASM_LOAD_FAILED`
- `WASM_UNSUPPORTED`
- `CODEC_NOT_INCLUDED`
- `COEP_REQUIRED`
- `MEDIA_LOAD_FAILED`
- `MEDIA_TIMEOUT`
- `AUTOPLAY_BLOCKED`

自动恢复只针对网络、manifest、WASM 和媒体加载的暂时失败：首次等待 500ms，第二次等待 1500ms，随后进入 `error`。不支持的 codec、版本不匹配、无效参数和自动播放阻止不自动重试。

`AUTOPLAY_BLOCKED` 是需要用户手势的可恢复状态，UI 显示播放按钮而不是通用故障面板。

## 10. 测试策略

开发遵循测试先行：先写会因目标行为缺失而失败的测试，再写最小实现使其通过。

### 10.1 单元测试

- 状态机合法转换。
- 操作队列严格串行。
- 连续 seek 合并。
- source epoch 隔离。
- 时间单位转换。
- WASM 能力检测和回退。
- codec 到资源映射。
- manifest 版本校验。
- 错误归一化。
- 销毁后的调用行为。

### 10.2 Vue 组件测试

- Props 更新和事件转发。
- `ref` 公开方法。
- 自动播放阻止状态。
- 控制栏显隐和键盘操作。
- 插槽。
- 卸载清理。
- 多实例隔离。

### 10.3 Vite 插件集成测试

建立不含 `tsconfig.json`、不含 `<script lang="ts">` 的 JavaScript Vue 3 fixture，验证：

- 能导入发布后的组件库。
- 开发服务器能提供 runtime、manifest 和 WASM。
- 生产构建包含正确预设和动态 chunk。
- `base: '/app/'` 下资源地址正确。
- `externalAssets` 不复制本地资源。

### 10.4 发布包消费测试

```bash
npm pack
npm install ../libmedia-avp-vue3-0.1.0.tgz
npm run build
```

必须使用打包后的 tarball 安装到 fixture，不能只依靠源码 alias。

### 10.5 浏览器冒烟测试

使用固定、合法授权的小型测试媒体：

- Chromium：H.264/AAC MP4。
- Chromium：HLS。
- Chromium：本地 `File`。
- Firefox：baseline WASM 回退。
- WebKit：baseline WASM 回退。
- 播放、暂停、seek、切源、全屏入口和卸载。
- 控制台没有未处理 Promise rejection。

自动化浏览器通过不等于 Android WebView、电视浏览器或特定硬件解码器验收通过；这些环境需单独记录真实设备结果。

## 11. 发布与依赖

- 包名为 `libmedia-avp-vue3`。
- 首个开发版本为 `0.1.0`。
- Vue 声明为 `peerDependency`，避免重复打包。
- libmedia 运行时相关依赖使用精确版本。
- 发布 ESM 和 CommonJS 入口、CSS、Vite 插件入口和 `.d.ts`。
- `files` 白名单只包含发布必需文件、许可证和 README。
- 不在未完成测试、许可证检查和 tarball 消费验证前发布到 npm。

## 12. 许可证与安全

- 保留 libmedia 的 LGPL-3.0-or-later 许可证和归属信息。
- 发布包包含第三方许可证清单、依赖版本和源码获取说明。
- 首版只交付解码器，不交付上游明确标注为 GPL 的 x264/x265 编码器。
- `assetBaseUrl` 只用于加载脚本、manifest 和 WASM；文档必须提示调用方只配置可信、固定版本的来源。
- 错误 UI 不泄露完整媒体 URL、请求头、令牌或底层堆栈。
- 不记录媒体 URL、File 内容和播放行为遥测。

## 13. 验收标准

1. 所有新增内容只位于 `libmedia-avp-vue3`；原 `libmedia-avp` 文件和 Git 状态保持不变。
2. JavaScript Vue 3 fixture 不配置 TypeScript即可构建。
3. `LibmediaPlayer`、`LibmediaPlayerCore` 和 `useLibmediaPlayer` 均有可运行示例。
4. `npm pack` 后重新安装、构建和运行验证通过。
5. 单元、Vue 组件和 Vite 插件测试通过。
6. 固定 MP4、HLS 和本地 File 完成 Chromium 冒烟播放。
7. Firefox 和 WebKit 完成 baseline 回退验证，无法通过的浏览器差异必须明确记录，不得以 Chromium 结果替代。
8. README 包含 JavaScript 安装、Vite 配置、公共 API、资源预设、自建 CDN、COOP/COEP、许可证和故障排查。
9. 发布产物不包含 x264/x265 编码器或无关开发文件。
10. 未经用户单独授权，不提交、推送或发布实现版本。

## 14. 参考资料

- libmedia 官方仓库：<https://github.com/zhaohappy/libmedia>
- 官方播放器指南：<https://github.com/zhaohappy/libmedia/blob/master/site/docs/guide/player.md>
- 官方构建工具示例：<https://github.com/zhaohappy/libmedia-example>
- libmedia 许可证：<https://github.com/zhaohappy/libmedia/blob/master/COPYING.LGPLv3>
