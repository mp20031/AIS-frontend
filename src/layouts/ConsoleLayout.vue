<template>
  <div class="console-responsive-shell">
    <div class="console-shell" :class="{ 'console-shell--collapsed': collapsed }">
      <SidebarNav :collapsed="collapsed" @toggle="collapsed = !collapsed" />
      <main class="console-content">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import SidebarNav from '@/components/SidebarNav.vue'

const collapsed = ref(false)
</script>
