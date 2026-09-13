<template>
  <div class="user-badge">
    <div class="user-badge__meta">
      <strong>{{ name }}</strong>
      <span>{{ role }}</span>
    </div>
    <div class="user-badge__avatar">{{ initials }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  name: { type: String, required: true },
  role: { type: String, required: true },
})

const initials = computed(() =>
  props.name
    .split(' ')
    .map((part) => part.at(0))
    .slice(0, 2)
    .join('')
    .toUpperCase(),
)
</script>
