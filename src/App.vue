<template>
  <AppShell v-if="route.meta.requiresAuth" />
  <RouterView v-else v-slot="{ Component }">
    <Transition name="page-fade" mode="out-in">
      <component :is="Component" />
    </Transition>
  </RouterView>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import AppShell from '@/layouts/AppShell.vue'

const route = useRoute()
</script>

<style>
.page-fade-enter-active {
  transition: opacity 0.35s ease, transform 0.35s ease;
}
.page-fade-leave-active {
  transition: opacity 0.15s ease;
}
.page-fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.page-fade-leave-to {
  opacity: 0;
}
</style>
