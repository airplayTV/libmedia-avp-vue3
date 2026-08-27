import { h } from 'vue'

function createIcon(name, paths) {
  return {
    name,
    setup() {
      return () => h('svg', {
        class: 'libmedia-icon',
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': 2,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'aria-hidden': 'true',
        focusable: 'false'
      }, paths.map((attributes) => h('path', attributes)))
    }
  }
}

export const PlayIcon = createIcon('LibmediaPlayIcon', [
  { d: 'm8 5 11 7-11 7Z' }
])
export const PauseIcon = createIcon('LibmediaPauseIcon', [
  { d: 'M9 5v14' },
  { d: 'M15 5v14' }
])
export const VolumeIcon = createIcon('LibmediaVolumeIcon', [
  { d: 'M11 5 6 9H3v6h3l5 4Z' },
  { d: 'M15 9.5a4 4 0 0 1 0 5' },
  { d: 'M18 7a7 7 0 0 1 0 10' }
])
export const MutedIcon = createIcon('LibmediaMutedIcon', [
  { d: 'M11 5 6 9H3v6h3l5 4Z' },
  { d: 'm16 10 5 5' },
  { d: 'm21 10-5 5' }
])
export const SettingsIcon = createIcon('LibmediaSettingsIcon', [
  { d: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z' },
  { d: 'M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.86 2.86-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1.55 1H9.55a1.7 1.7 0 0 0-1.55-1 1.7 1.7 0 0 0-1.88.34l-.06.06-2.86-2.86.06-.06A1.7 1.7 0 0 0 3.6 15a1.7 1.7 0 0 0-1-1.55v-3.9A1.7 1.7 0 0 0 3.6 8a1.7 1.7 0 0 0-.34-1.88l-.06-.06L6.06 3.2l.06.06A1.7 1.7 0 0 0 8 3.6a1.7 1.7 0 0 0 1.55-1h3.9A1.7 1.7 0 0 0 15 3.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.86 2.86-.06.06A1.7 1.7 0 0 0 19.4 8a1.7 1.7 0 0 0 1 1.55v3.9a1.7 1.7 0 0 0-1 1.55Z' }
])
export const FullscreenIcon = createIcon('LibmediaFullscreenIcon', [
  { d: 'M8 3H3v5' },
  { d: 'M16 3h5v5' },
  { d: 'M21 16v5h-5' },
  { d: 'M3 16v5h5' }
])
export const RetryIcon = createIcon('LibmediaRetryIcon', [
  { d: 'M20 11a8 8 0 1 0-2.34 5.66' },
  { d: 'M20 4v7h-7' }
])

