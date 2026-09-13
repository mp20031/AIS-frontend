<template>
  <aside class="sidebar" :class="{ 'sidebar--collapsed': collapsed }">
    <div class="sidebar__brand-row">
      <AppLogo />
      <button class="sidebar__toggle" type="button" :aria-label="toggleLabel" @click="$emit('toggle')">
        <PanelLeftClose v-if="!collapsed" :size="18" />
        <PanelLeftOpen v-else :size="18" />
      </button>
    </div>
    <nav class="sidebar__nav" aria-label="Secciones">
      <RouterLink to="/dashboard">
        <LayoutDashboard :size="16" />
        <span>Dashboard</span>
      </RouterLink>
      <RouterLink to="/seguridad">
        <ShieldCheck :size="16" />
        <span>Seguridad</span>
      </RouterLink>
    </nav>
    <div class="sidebar__profile">
      <div class="sidebar__initials">JP</div>
      <div>
        <strong>Juan Perez</strong>
        <span>Administrador</span>
      </div>
    </div>
    <button class="sidebar__logout" type="button" aria-label="Cerrar sesion" @click="logout">
      <LogOut :size="16" />
      <span>Cerrar sesion</span>
    </button>
  </aside>
</template>

<script setup>
import { computed } from 'vue'
import { LayoutDashboard, LogOut, PanelLeftClose, PanelLeftOpen, ShieldCheck } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import AppLogo from '@/components/AppLogo.vue'
import { authService } from '@/services/authService'

const props = defineProps({
  collapsed: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['toggle'])

const router = useRouter()
const toggleLabel = computed(() => (props.collapsed ? 'Expandir menu' : 'Contraer menu'))

const logout = () => {
  authService.logout()
  router.replace({ name: 'login' })
}
</script>
