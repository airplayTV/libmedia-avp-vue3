<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

defineOptions({ name: 'PlayerContextMenu' })

const props = defineProps({
  open: { type: Boolean, default: false },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 }
})

const emit = defineEmits(['close', 'select'])
const layerRef = ref(null)
const menuRef = ref(null)
const positionStyle = ref({ left: '8px', top: '8px' })

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(minimum, value), Math.max(minimum, maximum))
}

function updatePosition() {
  const layer = layerRef.value
  const parent = layer?.offsetParent
  if (!layer || !parent) return
  positionStyle.value = {
    left: `${clamp(props.x, 8, parent.clientWidth - layer.offsetWidth - 8)}px`,
    top: `${clamp(props.y, 8, parent.clientHeight - layer.offsetHeight - 8)}px`
  }
}

function focusItem(index) {
  const items = [...(menuRef.value?.querySelectorAll('[role="menuitem"]') ?? [])]
  items.at(index)?.focus()
}

function handleKeydown(event) {
  if (event.key === 'Tab') {
    event.preventDefault()
    emit('close', { restoreFocus: true })
    return
  }
  const items = [...(menuRef.value?.querySelectorAll('[role="menuitem"]') ?? [])]
  const current = items.indexOf(document.activeElement)
  const actions = {
    ArrowDown: () => focusItem((current + 1) % items.length),
    ArrowUp: () => focusItem((current - 1 + items.length) % items.length),
    Home: () => focusItem(0),
    End: () => focusItem(-1),
    Escape: () => emit('close', { restoreFocus: true })
  }
  const action = actions[event.key]
  if (!action) return
  event.preventDefault()
  action()
}

function handleDocumentPointerDown(event) {
  if (props.open && !menuRef.value?.contains(event.target)) emit('close')
}

watch([() => props.open, () => props.x, () => props.y], async ([open]) => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
  if (!open) return
  document.addEventListener('pointerdown', handleDocumentPointerDown, true)
  await nextTick()
  updatePosition()
  focusItem(0)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
})
</script>

<template>
  <div
    v-if="open"
    ref="layerRef"
    class="libmedia-context-menu-layer"
    :style="positionStyle"
    @contextmenu.prevent.stop
  >
    <div
      ref="menuRef"
      class="libmedia-context-menu"
      role="menu"
      aria-label="播放器菜单"
      @click.stop
      @keydown.stop="handleKeydown"
    >
      <button type="button" role="menuitem" @click="emit('select', 'info')">
        视频信息
      </button>
      <button type="button" role="menuitem" @click="emit('select', 'logs')">
        播放日志
      </button>
      <button type="button" role="menuitem" @click="emit('select', 'player')">
        播放器信息
      </button>
    </div>
  </div>
</template>
