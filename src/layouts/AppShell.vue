<template>
  <div class="console-responsive-shell">
    <div class="console-shell" :class="{ 'console-shell--collapsed': collapsed }">
      <SidebarNav :collapsed="collapsed" @toggle="collapsed = !collapsed" />
      <main class="console-content" :class="{ 'portal-content': route.meta.portalPadding }">
        <RouterView v-slot="{ Component }">
          <Transition name="page-fade" mode="out-in">
            <component :is="Component" :key="route.path" />
          </Transition>
        </RouterView>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import SidebarNav from '@/components/SidebarNav.vue'

const collapsed = ref(false)
const route = useRoute()
</script>
