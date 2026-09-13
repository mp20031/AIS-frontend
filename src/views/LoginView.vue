<template>
  <AuthLayout>
    <form class="login-card" @submit.prevent="submit">
      <div>
        <h1>Iniciar sesión</h1>
        <p>Ingresa tus credenciales para entrar al hub inspectorial.</p>
      </div>

      <label>
        <span>Correo institucional</span>
        <input v-model="form.email" type="email" autocomplete="email" placeholder="nombre@salesianoscam.org" />
      </label>

      <label>
        <span>Contraseña</span>
        <input v-model="form.password" type="password" autocomplete="current-password" placeholder="********" />
      </label>

      <label>
        <span>Rol de acceso (demo)</span>
        <select v-model="form.role">
          <option value="admin">Administrador — acceso total</option>
          <option value="rrhh">RRHH — gestión institucional</option>
          <option value="consulta">Consulta - solo lectura</option>
        </select>
      </label>

      <label class="login-card__check">
        <input v-model="form.remember" type="checkbox" />
        <span>Mantener sesion iniciada</span>
      </label>

      <button type="submit">Entrar al portal</button>

      <p class="login-card__note">
        Este es un entorno de demostración — cualquier correo/contraseña funciona;
        el rol seleccionado determina qué módulos verás.
      </p>
    </form>
  </AuthLayout>
</template>

<script setup>
import { reactive } from 'vue'
import { useRouter } from 'vue-router'
import AuthLayout from '@/layouts/AuthLayout.vue'
import { authService } from '@/services/authService'

const router = useRouter()
const form = reactive({
  email: 'j.perez@salesianos.edu.sv',
  password: '123456789',
  role: 'admin',
  remember: true,
})

const submit = async () => {
  await authService.login(form)
  router.push({ name: 'dashboard' })
}
</script>
