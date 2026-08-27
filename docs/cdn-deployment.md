# CDN 与生产部署

## 目录与版本

将一次构建生成的整个 `assets/libmedia-avp/` 原样发布到不可变版本目录，例如：

```text
https://cdn.example.com/libmedia-avp/1.3.1/
├── manifest.json
├── runtime/avplayer.js
├── runtime/*.avplayer.js
└── wasm/{baseline,simd,atomic}/*.wasm
```

运行时、分块、WASM 和 manifest 必须来自同一次同步，不得混用版本。先发布不可变目录并校验所有 SHA-256，再原子切换业务配置；回滚只切回上一完整目录。

## MIME 与缓存

- `.wasm`: `Content-Type: application/wasm`
- `.js`: `Content-Type: application/javascript; charset=utf-8`
- `.json`: `Content-Type: application/json; charset=utf-8`
- 固定版本目录可使用 `Cache-Control: public, max-age=31536000, immutable`
- HTML 或业务侧的版本指针应短缓存，并支持快速回滚

禁止 CDN 把 404 HTML、登录页或压缩错误页以 200 返回给 WASM 请求。

## CORS、CORP 与 atomic

跨域 CDN 至少返回与业务域匹配的 `Access-Control-Allow-Origin`。不要在携带凭据时使用通配符。若要启用 atomic/线程 WASM，顶层页面必须处于跨源隔离状态：

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

CDN 资源还必须满足 CORS/嵌入策略，例如：

```http
Access-Control-Allow-Origin: https://app.example.com
Cross-Origin-Resource-Policy: cross-origin
```

确认页面中的 `crossOriginIsolated === true`、`SharedArrayBuffer` 可用，并用生产域名实际加载 atomic WASM。条件不满足时 `wasmVariant: 'auto'` 会降级到 SIMD 或 baseline。

## 外部资源模式

Vite 配置：

```js
import { libmediaAssets } from 'libmedia-avp-vue3/vite'

export default {
  plugins: [libmediaAssets({ externalAssets: true })]
}
```

组件配置固定版本根 URL：

```vue
<LibmediaPlayer asset-base-url="https://cdn.example.com/libmedia-avp/1.3.1/" />
```

若运行时页面部署在子路径，非 CDN 模式下插件会结合 Vite `base` 自动注入资源根路径。

## 发布前检查

- manifest 的 `avplayerVersion` 为 `1.3.1`，提交为 `152f629d3021fd8013efa464fcb7b55f9fbe7753`。
- 每个 manifest 文件存在、大小非零、SHA-256 匹配。
- Range/CORS/Referer/Cookie 行为与生产媒体源兼容。
- MP4、HLS、DASH、切源、后台恢复和销毁在目标浏览器/设备实测。
- 先小流量灰度；监控 `RUNTIME_LOAD_FAILED`、`WASM_LOAD_FAILED`、`MEDIA_TIMEOUT` 与播放首帧耗时。
