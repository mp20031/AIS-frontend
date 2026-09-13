<template>
  <img
    class="brand"
    :class="{ 'brand--compact': compact }"
    :src="logoSrc"
    alt="Asociacion Institucion Salesiana"
  />
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  compact: {
    type: Boolean,
    default: false,
  },
  variant: {
    type: String,
    default: 'negative',
    validator: (value) => ['negative', 'positive', 'full'].includes(value),
  },
})

const sources = {
  negative: '/assets/brand/ais-negativo.png',
  positive: '/assets/brand/ais-positivo.png',
  full: '/assets/brand/ais-full-color.png',
}

const logoSrc = computed(() => sources[props.variant])
</script>
