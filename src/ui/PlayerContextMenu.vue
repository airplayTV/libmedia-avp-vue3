<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

defineOptions({ name: 'PlayerContextMenu' })

const props = defineProps({
  open: { type: Boolean, default: false },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 }
})

const emit = defineEmits(['close', 'select'])
const menuRef = ref(null)

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

watch(() => props.open, async (open) => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
  if (!open) return
  document.addEventListener('pointerdown', handleDocumentPointerDown, true)
  await nextTick()
  focusItem(0)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
})
</script>

<template>
  <div
    v-if="open"
    class="libmedia-context-menu-layer"
    @click.stop="emit('close')"
    @contextmenu.prevent.stop
  >
    <div
      ref="menuRef"
      class="libmedia-context-menu"
      role="menu"
      aria-label="播放器菜单"
      :style="{
        '--libmedia-menu-x': `${x}px`,
        '--libmedia-menu-y': `${y}px`
      }"
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
