<template>
  <header class="top-nav">
    <AppLogo compact />
    <nav class="top-nav__links" aria-label="Principal">
      <RouterLink to="/dashboard">Dashboard</RouterLink>
      <RouterLink to="/seguridad">Permisos</RouterLink>
    </nav>
    <UserBadge :name="user.name" :role="user.role" />
  </header>
</template>

<script setup>
import AppLogo from '@/components/AppLogo.vue'
import UserBadge from '@/components/UserBadge.vue'

defineProps({
  user: { type: Object, required: true },
})
</script>
