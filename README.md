# libmedia-avp-vue3

基于 Vue 3 的 libmedia AVPlayer 封装，提供完整播放器、无头核心组件和组合式 API。消费项目可以是纯 JavaScript；不要求 `tsconfig.json`，也不要求在 `.vue` 文件中使用 `lang="ts"`。

当前仓库版本为 `0.1.0`，尚未发布，且包仍为 `private: true`、`UNLICENSED`。本地联调可使用 `npm pack` 产生的 tarball；公开发布前必须先确定包装层许可证与包名归属。

## 安装与 Vite 配置

```bash
npm install ./libmedia-avp-vue3-0.1.0.tgz
```

纯 JavaScript `vite.config.js`：

```js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { libmediaAssets } from 'libmedia-avp-vue3/vite'

export default defineConfig({
  plugins: [
    vue(),
    libmediaAssets({
      preset: 'minimal',
      codecs: ['h264', 'aac']
    })
  ]
})
```

插件在开发服务器中以只读方式提供资源，并在生产构建时输出到 `assets/libmedia-avp/`。默认控制器会读取该目录的 `manifest.json`，校验 AVPlayer `1.3.1` 和固定上游提交，再加载运行时和 WASM。

## 完整播放器

```vue
<script setup>
import { ref } from 'vue'
import { LibmediaPlayer } from 'libmedia-avp-vue3'
import 'libmedia-avp-vue3/style.css'

const source = ref('/media/movie.m3u8')
const player = ref(null)
</script>

<template>
  <LibmediaPlayer
    ref="player"
    :src="source"
    theme-color="#22c55e"
    :volume="0.8"
    controls
    playsinline
    @ready="({ duration }) => console.log(duration)"
    @error="(error) => console.error(error.code)"
  />
</template>
```

内置控件支持键盘播放、seek、音量、轨道选择、倍速和全屏，并把快捷键限制在播放器获得焦点时。上游 Worker 管线默认关闭，以避免缺少隔离头或 Worker 资源初始化时永久停在 `loading`；确有需求时可通过 `engineOptions.enableWorker` 显式开启并自行完成浏览器验收。

## 无头核心组件

`LibmediaPlayerCore` 负责生命周期、资源、错误和 AVPlayer 控制，不规定控件布局：

```vue
<script setup>
import { LibmediaPlayerCore } from 'libmedia-avp-vue3'
</script>

<template>
  <LibmediaPlayerCore v-slot="player" src="/media/movie.mp4">
    <button type="button" @click="player.play()">播放</button>
    <button type="button" @click="player.pause()">暂停</button>
    <input
      type="range"
      min="0"
      :max="player.duration"
      :value="player.currentTime"
      @change="player.seek(Number($event.target.value))"
    >
  </LibmediaPlayerCore>
</template>
```

## 组合式 API

```vue
<script setup>
import { ref } from 'vue'
import { useLibmediaPlayer } from 'libmedia-avp-vue3'

const source = ref(null)
const player = useLibmediaPlayer({ src: source })

function openFile(event) {
  source.value = event.target.files?.[0] ?? null
}
</script>

<template>
  <div :ref="player.containerRef" />
  <input type="file" @change="openFile">
  <button type="button" @click="player.play()">播放</button>
</template>
```

`src` 支持 HTTP(S) URL、HLS、DASH、常见容器 URL 以及浏览器 `File`。远程媒体仍受源站 CORS、鉴权、防盗链、编解码器和浏览器能力约束。

## 公共契约

主要 props：

| prop | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `src` | `string \| File \| null` | `null` | 播放源 |
| `autoplay` | `boolean` | `false` | 浏览器仍可能要求用户手势 |
| `muted` / `volume` | `boolean` / `number` | `false` / `1` | 音量范围 `[0, 1]` |
| `loop` / `controls` | `boolean` | `false` / `true` | 循环和内置控件 |
| `poster` | `string` | `''` | 海报 URL |
| `themeColor` | `string` | `''` | 控件主题色；未传入时使用 `--libmedia-accent`，默认信号绿 `#22c55e` |
| `assetBaseUrl` | `string` | Vite 插件注入值 | 本地资源或固定版本 CDN 根路径 |
| `wasmVariant` | `auto \| baseline \| simd \| atomic` | `auto` | 能力不满足时安全降级 |
| `loadOptions` / `engineOptions` | `object` | `{}` | 上游高级选项；内部 `container/getWasm` 不可覆盖 |

事件：`loading`、`ready`、`play`、`pause`、`timeupdate`、`durationchange`、`seeking`、`seeked`、`ended`、`volumechange`、`statechange`、`diagnostic`、`error`。时间统一为秒，错误事件只暴露稳定的公开字段。

组件 ref 方法：`load`、`play`、`pause`、`stop`、`seek`、`setVolume`、`mute`、`unmute`、`enterFullscreen`、`exitFullscreen`、`getStats`。

组合式 API 另外提供：`setPlaybackRate`、三类 `get*List`、`selectVideo`、`selectAudio`、`selectSubtitle`、`resize` 和 `destroy`。

## 画面交互与播放诊断

完整播放器在 `controls=true` 时提供以下内置交互：

- 左键点击视频画面切换播放/暂停；快速连续点击会按最后一次点击的目标状态合并命令，不会重复调用 `play()`；加载中、错误和未加载状态不会误触发播放。
- 右键点击视频画面打开自定义菜单，可查看视频信息和最近 100 条播放日志。
- 右键菜单支持方向键、`Home`、`End`、`Enter` 和 `Escape`；关闭诊断面板后焦点返回播放器。

视频信息展示当前实际加载的文件或 URL，并支持复制；URL 会按调用方传入值原样显示和复制，包括查询参数及鉴权参数。本地 `File` 受浏览器安全限制，只能显示和复制文件名，不能取得本地绝对路径。请勿向无关人员分享包含敏感鉴权参数的视频信息截图。

播放日志使用中文事件、中文状态和中文说明，技术错误码保留在说明后用于定位。日志不会记录完整 URL、查询参数、Token、Cookie、请求头、错误堆栈或上游原始对象，不能替代浏览器网络面板中的底层请求诊断。

`controls=false` 时不会启用画面点击或自定义右键菜单行为，适合通过 `LibmediaPlayerCore`、插槽或组合式 API 构建自定义界面。

## 资源预设

| preset | 用途 | 说明 |
| --- | --- | --- |
| `minimal` | 已知 H.264/AAC/MP3 场景 | 默认目录的子集，可再用 `codecs` 缩减 |
| `standard` | 常规 Web 播放 | 当前随包资源的默认集合，包含 H.264、HEVC、AV1、VP8/VP9、AAC、Opus 等 |
| `full` | 长尾传统格式 | 发布维护者须先同步 full 资源，或用 `externalAssets` 指向包含完整清单的固定版本 CDN；当前 standard 归档会明确报 `ASSET_NOT_AVAILABLE` |

`wasmVariants` 可限制 `baseline`、`simd`、`atomic`。`threading: false` 会排除 atomic；atomic 需要跨源隔离。插件拒绝绝对路径、反斜杠和 `..` 输出路径。

## 固定版本 CDN

```js
libmediaAssets({ externalAssets: true })
```

```vue
<LibmediaPlayer
  src="/media/movie.m3u8"
  asset-base-url="https://cdn.example.com/libmedia-avp/1.3.1/"
/>
```

该目录必须包含匹配本库的 `manifest.json`、`runtime/` 和 `wasm/`。不要使用浮动 `latest` 路径。完整响应头、缓存、CORS 和回滚要求见 [CDN 部署](docs/cdn-deployment.md)。

## 验证命令

```bash
npm run test:run
npm run build
npm run verify:package
npm run test:vite-matrix
npm run playground:build
npm run test:browser
```

浏览器自动化覆盖 Chromium、Firefox、WebKit；它不等同于目标手机、电视 WebView、硬件解码器和生产 CDN 的实机验收。

错误码和定位步骤见 [故障排查](docs/troubleshooting.md)。第三方许可证与固定源码地址见 [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md)。

## 运行 Example

`example/` 是一个独立的纯 JavaScript Vue 3 消费项目，只通过包的公开导出加载组件、CSS 和 Vite 资源插件。

```bash
npm install
npm run example:dev
```

默认地址为 `http://localhost:5173`。生产构建和 Chromium 回归：

```bash
npm run example:build
npm run test:example
```
