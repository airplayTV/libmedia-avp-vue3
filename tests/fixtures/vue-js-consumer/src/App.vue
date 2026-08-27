<script setup>
import { ref } from 'vue'
import {
  LibmediaPlayer,
  LibmediaPlayerCore,
  useLibmediaPlayer
} from 'libmedia-avp-vue3'
import 'libmedia-avp-vue3/style.css'

const source = ref(null)
const customPlayer = useLibmediaPlayer({ src: source })
</script>

<template>
  <main>
    <LibmediaPlayer :src="source" />
    <LibmediaPlayerCore :src="source" />
    <div :ref="customPlayer.containerRef" />
  </main>
</template>
