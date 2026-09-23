<template>
  <div class="console-responsive-shell">
    <div class="console-shell" :class="{ 'console-shell--collapsed': collapsed }">
      <SidebarNav :collapsed="collapsed" @toggle="collapsed = !collapsed" />
      <main ref="content" class="console-content" :class="{ 'portal-content': route.meta.portalPadding }">
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
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import SidebarNav from '@/components/SidebarNav.vue'
import { useSession } from '@/composables/useSession'

const collapsed = ref(false)
const route = useRoute()

// The page itself no longer scrolls (only this pane does), so the router's
// scrollBehavior can't reset it: do it here when the route changes.
const content = ref<HTMLElement | null>(null)
watch(() => route.path, () => content.value?.scrollTo({ top: 0 }))

// One call per app load, here at the shell rather than in each view: this is
// the first authenticated component to mount, and it also catches a token
// whose account was deactivated while the tab sat open.
const { load } = useSession()
onMounted(() => load())
</script>
