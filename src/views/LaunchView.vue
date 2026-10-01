<template>
  <section class="launch-view">
    <div class="security-card launch-card">
      <template v-if="!error">
        <span class="launch-card__spinner" aria-hidden="true"></span>
        <h2>Abriendo {{ moduleKey }}…</h2>
        <p>Preparando tu acceso. No vuelves a escribir tu contraseña.</p>
      </template>
      <template v-else>
        <h2>No se pudo abrir la aplicación</h2>
        <p class="login-card__error">{{ error }}</p>
        <RouterLink class="btn" :to="{ name: 'dashboard' }">Volver al inicio</RouterLink>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { meService } from '@/services/meService'

// FR-65: the one entry point into a module. The router has already made sure
// the user is logged in here (sending them through /login and back if not), so
// all that's left is a one-time code and a redirect to the module's callback.
const route = useRoute()
const moduleKey = String(route.params.moduleKey)
const error = ref('')

onMounted(async () => {
  try {
    const { redirect_url } = await meService.startHandoff(moduleKey)
    // replace: "back" from the module shouldn't land on this page and relaunch.
    window.location.replace(redirect_url)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'No se pudo abrir la aplicación'
  }
})
</script>
