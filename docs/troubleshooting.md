# 故障排查

## 快速证据链

1. 记录公开 `error.code`、浏览器、页面 URL、媒体类型和操作顺序；不要记录 token、Cookie 或完整私有媒体 URL。
2. 在 Network 中确认 `manifest.json`、`runtime/avplayer.js`、分块和 WASM 的状态码、MIME、CORS 与响应体。
3. 校验 manifest 版本/提交以及所选 codec/variant 是否实际存在。
4. 区分“自动化浏览器通过”和“目标 WebView/电视/手机实机通过”。硬件解码、音频策略和厂商内核必须单独验收。

## 错误码

| 错误码 | 含义 | 处理 |
| --- | --- | --- |
| `RUNTIME_LOAD_FAILED` | manifest、JS 运行时或默认工厂加载失败 | 检查基址、HTTP 状态、MIME、CORS 和动态 import |
| `RUNTIME_VERSION_MISMATCH` | manifest schema、AVPlayer 版本或提交不匹配 | 原子发布同一版本的完整目录，禁止混用缓存 |
| `WASM_LOAD_FAILED` / `WASM_NOT_FOUND` | WASM 下载、编译或共享资源缺失 | 检查 `application/wasm`、哈希、resample/stretchpitch 和 variant |
| `CODEC_NOT_INCLUDED` | 当前 preset 没有对应解码器 | 在 `codecs` 中加入资源，选择更大 preset，或部署匹配 CDN |
| `WASM_UNSUPPORTED` | 请求的 SIMD/atomic 不受浏览器或清单支持 | 改用 `auto`/`baseline`；atomic 检查 COOP/COEP |
| `MEDIA_LOAD_FAILED` | 媒体请求、探测、解复用或解码失败 | 检查媒体 CORS、Range、鉴权、防盗链、容器和 codec |
| `MEDIA_TIMEOUT` | 上游操作超时 | 对比源站/CDN耗时；检查网络和资源是否卡住 |
| `AUTOPLAY_BLOCKED` | 浏览器要求用户手势 | 展示播放按钮，在真实点击事件中调用 `play()` |
| `INVALID_SOURCE` | 空源或非法资源基址 | 传非空 HTTP(S) URL 或 `File` |
| `SOURCE_CHANGED` / `OPERATION_SUPERSEDED` | 切源时旧操作被主动取消 | 通常是预期控制流；不要当成新源失败 |
| `PLAYER_DESTROYED` | 销毁后继续调用 | 组件卸载后停止持有旧 ref/composable |

## 永久停在 loading

- 默认包装层设置 `enableWorker: false`，避免上游 Worker 管线初始化不完整时无媒体请求也不报错。
- 若业务显式开启 `engineOptions.enableWorker: true`，检查 blob worker、动态分块、CSP、COOP/COEP，并建立超时监控。
- 确认 `runtime/avplayer.js` 之后确实出现媒体和 WASM 请求；只有 blob worker、没有媒体请求是 Worker 初始化阻塞的重要证据。

## Safari/WebKit 音频

完整播放器会在环境既无 `AudioContext` 也无 `webkitAudioContext` 时自动以 `{ video: true, audio: false }` 播放，防止上游未处理的引用错误。真实 Safari 通常具备音频上下文；若仍被策略暂停，应在用户手势中调用 `play()`，并检查页面/iframe 的 autoplay 权限。

## 本地 File

切换 File 时不要自行创建长期 blob URL；包装层直接把 `File` 交给 AVPlayer。组件卸载或换源时会串行 stop/destroy，旧源事件通过 epoch 隔离。
