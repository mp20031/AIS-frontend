<template>
  <main class="auth-layout">
    <section class="auth-layout__brand">
      <AppLogo />
    </section>
    <section class="auth-layout__panel">
      <slot />
    </section>
  </main>
</template>

<script setup lang="ts">
import AppLogo from '@/components/AppLogo.vue'
</script>
