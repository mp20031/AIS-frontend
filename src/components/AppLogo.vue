<template>
  <img
    class="brand"
    :class="{ 'brand--compact': compact }"
    :src="logoSrc"
    alt="Asociacion Institucion Salesiana"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'

type LogoVariant = 'negative' | 'positive' | 'full'

const props = withDefaults(
  defineProps<{
    compact?: boolean
    variant?: LogoVariant
  }>(),
  {
    compact: false,
    variant: 'negative',
  },
)

const sources: Record<LogoVariant, string> = {
  negative: '/assets/brand/ais-negativo.png',
  positive: '/assets/brand/ais-positivo.png',
  full: '/assets/brand/ais-full-color.png',
}

const logoSrc = computed(() => sources[props.variant])
</script>
