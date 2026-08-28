<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

defineOptions({ name: 'PlayerDiagnostics' })

const props = defineProps({
  open: { type: Boolean, default: false },
  tab: { type: String, default: 'info' },
  info: { type: Array, default: () => [] },
  logs: { type: Array, default: () => [] }
})

const emit = defineEmits(['close', 'tab'])
const closeRef = ref(null)
const dialogRef = ref(null)
const copiedLabel = ref('')
const copyErrorLabel = ref('')
const copyStatus = ref('')
let copyFeedbackTimer = null

watch(() => props.open, async (open) => {
  if (!open) return
  await nextTick()
  closeRef.value?.focus()
})

function handleKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
    return
  }
  if (event.key !== 'Tab') return
  const focusable = [...(dialogRef.value?.querySelectorAll('button:not([disabled])') ?? [])]
  if (focusable.length === 0) return
  const first = focusable[0]
  const last = focusable.at(-1)
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

function handleTabKeydown(event) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const nextTab = ['ArrowRight', 'End'].includes(event.key) ? 'logs' : 'info'
  emit('tab', nextTab)
  nextTick(() => {
    dialogRef.value
      ?.querySelector(`[role="tab"][data-tab="${nextTab}"]`)
      ?.focus()
  })
}

function fallbackCopy(value) {
  const input = document.createElement('textarea')
  try {
    input.value = value
    input.setAttribute('readonly', '')
    input.style.position = 'fixed'
    input.style.opacity = '0'
    document.body.appendChild(input)
    input.select()
    return typeof document.execCommand === 'function' && document.execCommand('copy')
  } catch {
    return false
  } finally {
    input.remove()
  }
}

async function copyInfo(item) {
  const value = item.copyValue ?? item.value
  if (!value) return
  let copied = false
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      copied = true
    }
  } catch {}
  if (!copied) copied = fallbackCopy(value)

  if (copied) {
    copiedLabel.value = item.label
    copyErrorLabel.value = ''
    copyStatus.value = '当前文件或 URL 已复制'
  } else {
    copiedLabel.value = ''
    copyErrorLabel.value = item.label
    copyStatus.value = '复制失败，请手动选择当前文件或 URL'
  }
  clearTimeout(copyFeedbackTimer)
  copyFeedbackTimer = setTimeout(() => {
    copiedLabel.value = ''
    copyErrorLabel.value = ''
    copyStatus.value = ''
  }, 1800)
}

onBeforeUnmount(() => clearTimeout(copyFeedbackTimer))
</script>

<template>
  <div
    v-if="open"
    class="libmedia-diagnostics-backdrop"
    @click.self="emit('close')"
    @contextmenu.prevent.stop
  >
    <section
      ref="dialogRef"
      class="libmedia-diagnostics"
      role="dialog"
      aria-modal="true"
      aria-label="播放诊断"
      @click.stop
      @keydown.stop="handleKeydown"
    >
      <header class="libmedia-diagnostics__header">
        <div>
          <span class="libmedia-diagnostics__eyebrow">LIBMEDIA</span>
          <h2>播放诊断</h2>
        </div>
        <button ref="closeRef" type="button" aria-label="关闭播放诊断" @click="emit('close')">
          关闭
        </button>
      </header>

      <div class="libmedia-diagnostics__tabs" role="tablist" aria-label="诊断内容">
        <button
          type="button"
          role="tab"
          data-tab="info"
          :aria-selected="tab === 'info'"
          :tabindex="tab === 'info' ? 0 : -1"
          @click="emit('tab', 'info')"
          @keydown="handleTabKeydown"
        >
          视频信息
        </button>
        <button
          type="button"
          role="tab"
          data-tab="logs"
          :aria-selected="tab === 'logs'"
          :tabindex="tab === 'logs' ? 0 : -1"
          @click="emit('tab', 'logs')"
          @keydown="handleTabKeydown"
        >
          播放日志
        </button>
      </div>

      <dl v-if="tab === 'info'" class="libmedia-diagnostics__info" role="tabpanel">
        <div
          v-for="item in info"
          :key="item.label"
          :class="{ 'libmedia-diagnostics__info-item--copyable': item.copyable }"
        >
          <dt>{{ item.label }}</dt>
          <dd>
            <span>{{ item.value }}</span>
            <button
              v-if="item.copyable"
              type="button"
              aria-label="复制当前文件或 URL"
              @click="copyInfo(item)"
            >
              {{ copiedLabel === item.label ? '已复制' : '复制' }}
            </button>
          </dd>
          <span
            v-if="copyErrorLabel === item.label"
            class="libmedia-diagnostics__copy-error"
          >
            复制失败，请手动选择
          </span>
        </div>
      </dl>

      <ol v-else class="libmedia-diagnostics__logs" role="tabpanel" aria-label="安全播放日志">
        <li v-if="logs.length === 0" class="libmedia-diagnostics__empty">
          暂无播放日志
        </li>
        <li
          v-for="(entry, index) in logs"
          :key="`${entry.time}-${index}`"
          class="libmedia-diagnostics__log-item"
        >
          <time>{{ entry.time }}</time>
          <strong>{{ entry.event }}</strong>
          <span v-if="entry.summary">{{ entry.summary }}</span>
        </li>
      </ol>

      <span class="libmedia-visually-hidden" role="status" aria-live="polite">
        {{ copyStatus }}
      </span>
    </section>
  </div>
</template>
