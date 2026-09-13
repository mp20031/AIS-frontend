<template>
  <ConsoleLayout>
    <section class="console-heading">
      <div>
        <h1>Seguridad · Roles y Permisos</h1>
        <p>Define que puede ver y hacer cada rol dentro del portal</p>
      </div>
      <button class="btn btn--primary" type="button">+ Nuevo Rol</button>
    </section>

    <section class="security-layout">
      <aside class="roles-panel">
        <button
          v-for="role in roles"
          :key="role.id"
          class="role-row"
          :class="{ 'role-row--active': role.id === selectedRole.id }"
          type="button"
          @click="selectedRole = role"
        >
          <span>
            <strong>{{ role.name }}</strong>
            <small>{{ role.description }}</small>
          </span>
          <em>{{ role.users }}</em>
        </button>
      </aside>

      <div class="security-main">
        <div class="security-card security-card--hero">
          <div>
            <h2>{{ selectedRole.name }}</h2>
            <p>Acceso total a todos los modulos y configuraciones</p>
          </div>
          <div class="security-card__actions">
            <button class="btn" type="button">Eliminar Rol</button>
            <button class="btn btn--primary" type="button">Guardar Cambios</button>
          </div>
        </div>

        <div class="permissions-grid">
          <section class="security-card">
            <h3>Modulos Visibles</h3>
            <p>Controla que secciones aparecen en la navegacion de este rol.</p>
            <ul class="toggle-list">
              <li v-for="module in visibleModules" :key="module">
                <span>{{ module }} <ExternalLink v-if="module !== 'Dashboard'" :size="13" /></span>
                <button class="switch switch--on" type="button" :aria-label="`Activar ${module}`"></button>
              </li>
            </ul>
          </section>

          <section class="security-card">
            <h3>Configuracion del Rol</h3>
            <p>Reglas y limites adicionales aplicados a este rol.</p>
            <div class="settings-form">
              <label>
                <span>Nivel de acceso</span>
                <input value="Alto" readonly />
              </label>
              <label class="settings-form__switch">
                <span>Aprobacion para acciones criticas</span>
                <button class="switch" type="button" aria-label="Aprobacion para acciones criticas"></button>
              </label>
              <label>
                <span>Limite de aprobacion financiera</span>
                <input value="Sin limite" readonly />
              </label>
              <label class="settings-form__switch">
                <span>Exportar reportes y datos</span>
                <button class="switch switch--on" type="button" aria-label="Exportar reportes y datos"></button>
              </label>
              <label>
                <span>Duracion maxima de sesion</span>
                <input value="12 horas" readonly />
              </label>
              <label>
                <span>Pagina de inicio predeterminada</span>
                <input value="Dashboard" readonly />
              </label>
            </div>
          </section>
        </div>
      </div>
    </section>
  </ConsoleLayout>
</template>

<script setup>
import { ref } from 'vue'
import { ExternalLink } from 'lucide-vue-next'
import ConsoleLayout from '@/layouts/ConsoleLayout.vue'
import { roles, visibleModules } from '@/data/security'

const selectedRole = ref(roles[0])
</script>
