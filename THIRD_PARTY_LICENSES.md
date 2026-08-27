# Third-party software notices

## libmedia AVPlayer

- Package: `@libmedia/avplayer`
- Version: `1.3.1`
- License: `LGPL-3.0-or-later`
- Copyright: Copyright (C) 2024-present, Gaoxing Zhao and libmedia contributors
- Repository: https://github.com/zhaohappy/libmedia
- Fixed source commit: `152f629d3021fd8013efa464fcb7b55f9fbe7753`
- Source tree: https://github.com/zhaohappy/libmedia/tree/152f629d3021fd8013efa464fcb7b55f9fbe7753
- Source archive: https://github.com/zhaohappy/libmedia/archive/152f629d3021fd8013efa464fcb7b55f9fbe7753.zip

The distributed `runtime-assets` directory contains the precompiled AVPlayer
runtime, its numeric runtime chunks, decoder WASM modules, resampling WASM and
stretch/pitch WASM derived from that fixed libmedia revision. The default
standard decoder set is:

```text
aac, ac3, adpcm, av1, dca, eac3, flac, h264, hevc, mjpeg, mp3,
mpeg2video, mpeg4, opus, pcm, vorbis, vp8, vp9
```

These modules use libmedia's FFmpeg-derived codec stack and remain subject to
their applicable upstream notices. The installed `@libmedia/avplayer`
dependency includes `COPYING.LGPLv3`; retain that license, this notice,
relinking/replacement
rights required by the LGPL, and an offer/access path for the exact
corresponding source when distributing the binaries. This notice is not legal
advice.

No encoder path is shipped. In particular, x264 and x265 encoder WASM/binaries
are excluded from `runtime-assets` and from the npm archive. The repository's
test-media generation script may invoke a developer-installed FFmpeg/libx264
executable solely to create project-owned test fixtures; that executable is
not distributed by this package.
