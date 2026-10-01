<template>
  <AuthLayout>
    <form class="login-card" @submit.prevent="submit">
      <div>
        <h1>Iniciar sesión</h1>
        <p>Ingresa tus credenciales para entrar al hub inspectorial.</p>
      </div>

      <label>
        <span>Usuario</span>
        <input v-model="form.email" type="text" autocomplete="username" placeholder="usuario o correo institucional" />
      </label>

      <label>
        <span>Contraseña</span>
        <input v-model="form.password" type="password" autocomplete="current-password" placeholder="********" />
      </label>

      <label class="login-card__check">
        <input v-model="form.remember" type="checkbox" />
        <span>Mantener sesion iniciada</span>
      </label>

      <button type="submit" :disabled="loading">{{ loading ? 'Ingresando...' : 'Entrar al portal' }}</button>

      <p v-if="error" class="login-card__error">{{ error }}</p>
    </form>
  </AuthLayout>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AuthLayout from '@/layouts/AuthLayout.vue'
import { authService } from '@/services/authService'

const router = useRouter()
const route = useRoute()

// Only same-site paths: an open redirect here would let a link send someone
// who just logged in to any site at all.
const redirectTarget = () => {
  const target = route.query.redirect
  return typeof target === 'string' && target.startsWith('/') && !target.startsWith('//') ? target : null
}
const form = reactive({
  email: 'jperez',
  password: 'changeme',
  remember: true,
})
const loading = ref(false)
const error = ref('')

const submit = async () => {
  error.value = ''

  if (!form.email.trim()) {
    error.value = 'Ingresa tu usuario o correo institucional.'
    return
  }
  if (!form.password) {
    error.value = 'Ingresa tu contraseña.'
    return
  }

  loading.value = true
  try {
    await authService.login(form)
    router.push(redirectTarget() ?? { name: 'dashboard' })
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'No se pudo iniciar sesión'
  } finally {
    loading.value = false
  }
}
</script>
