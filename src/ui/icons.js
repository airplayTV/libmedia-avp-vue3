import { h } from 'vue'

function createIcon(name, nodes, options = {}) {
  const solid = options.solid === true

  return {
    name,
    setup() {
      return () => h('svg', {
        class: ['libmedia-icon', solid ? 'libmedia-icon--solid' : 'libmedia-icon--outline'],
        viewBox: '0 0 24 24',
        fill: solid ? 'currentColor' : 'none',
        stroke: solid ? 'none' : 'currentColor',
        'stroke-width': solid ? undefined : 1.8,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'aria-hidden': 'true',
        focusable: 'false'
      }, nodes.map((node) => {
        const { tag = 'path', ...attributes } = node
        return h(tag, attributes)
      }))
    }
  }
}

export const PlayIcon = createIcon('LibmediaPlayIcon', [
  { d: 'M4.5 3.7c0-1.14 1.26-1.83 2.23-1.22l14.16 8.3a1.42 1.42 0 0 1 0 2.44l-14.16 8.3C5.76 22.13 4.5 21.44 4.5 20.3V3.7Z' }
], { solid: true })
export const PauseIcon = createIcon('LibmediaPauseIcon', [
  { tag: 'rect', x: 4.5, y: 3, width: 5.5, height: 18, rx: 2.2 },
  { tag: 'rect', x: 14, y: 3, width: 5.5, height: 18, rx: 2.2 }
], { solid: true })
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
  { tag: 'circle', cx: 12, cy: 12, r: 3 },
  { d: 'M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a8 8 0 0 0-1.8-1L14.4 3H9.6l-.3 3a8 8 0 0 0-1.8 1l-2.4-1-2 3.5 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a8 8 0 0 0 1.8 1l.3 3h4.8l.3-3a8 8 0 0 0 1.8-1l2.4 1 2-3.5-2-1.5a7 7 0 0 0 .1-1Z' }
])
export const FullscreenIcon = createIcon('LibmediaFullscreenIcon', [
  { d: 'M8 3H3v5' },
  { d: 'M16 3h5v5' },
  { d: 'M21 16v5h-5' },
  { d: 'M3 16v5h5' }
])
export const ExitFullscreenIcon = createIcon('LibmediaExitFullscreenIcon', [
  { d: 'M8 3v5H3' },
  { d: 'M16 3v5h5' },
  { d: 'M21 16h-5v5' },
  { d: 'M3 16h5v5' }
])
export const RetryIcon = createIcon('LibmediaRetryIcon', [
  { d: 'M20 11a8 8 0 1 0-2.34 5.66' },
  { d: 'M20 4v7h-7' }
])
export const CloseIcon = createIcon('LibmediaCloseIcon', [
  { d: 'm6 6 12 12' },
  { d: 'M18 6 6 18' }
])
export const RestoreIcon = createIcon('LibmediaRestoreIcon', [
  { d: 'm9 5-5 5 5 5' },
  { d: 'M4 10h9a7 7 0 0 1 7 7v2' }
])
