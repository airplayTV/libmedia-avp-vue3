const codecResources = Object.freeze({
  2: 'mpeg2video',
  7: 'mjpeg',
  12: 'mpeg4',
  27: 'h264',
  139: 'vp8',
  167: 'vp9',
  173: 'hevc',
  225: 'av1',
  86017: 'mp3',
  86018: 'aac',
  86019: 'ac3',
  86020: 'dca',
  86021: 'vorbis',
  86028: 'flac',
  86056: 'eac3',
  86076: 'opus'
})

export function getCodecResource(codecId) {
  return codecResources[codecId] ?? null
}

