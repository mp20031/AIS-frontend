<template>
  <div class="dashboard-view">
    <section class="control-heading">
      <div>
        <h1>Panel de Control Institucional</h1>
        <p>Resumen general de sedes y gestion financiera</p>
      </div>
      <div class="control-heading__actions">
        <button class="soft-action" type="button">
          <CalendarDays :size="14" />
          Periodo: Agosto 2026
        </button>
        <button class="soft-action soft-action--gray" type="button">
          <Download :size="14" />
          Exportar
        </button>
      </div>
    </section>

    <section v-auto-animate class="control-card module-status-card">
      <div class="control-card__title">
        <h2>Estado de Modulos</h2>
        <span>Modulos a los que tu rol te da acceso</span>
      </div>

      <p v-if="modulesLoading">Cargando tus modulos...</p>
      <p v-else-if="modulesError" class="login-card__error">{{ modulesError }}</p>
      <p v-else-if="!myModules.length" class="security-card__empty">
        Tu usuario no tiene permisos asignados en ningun modulo todavia.
      </p>

      <div v-else v-auto-animate class="module-status-grid">
        <article v-for="module in myModules" :key="module.id" class="module-status">
          <h3>
            <span class="status-dot status-dot--green"></span>
            {{ module.name }}
            <ExternalLink :size="12" />
          </h3>
          <strong class="status-pill status-pill--green">Acceso concedido</strong>
          <p>{{ module.permission_codes.join(', ') }}</p>
        </article>
      </div>
    </section>

    <section class="control-stats" aria-label="Indicadores generales">
      <article
        v-for="stat in controlStats"
        :key="stat.label"
        class="control-stat"
        :class="{ 'control-stat--alert': stat.alert }"
      >
        <span>{{ stat.label }}</span>
        <strong>{{ stat.value }}</strong>
        <p>{{ stat.detail }}</p>
      </article>
    </section>

    <section class="control-bottom-grid">
      <article class="control-card payroll-card">
        <h2>Ejecucion de Nomina por Sede ($ USD)</h2>
        <div class="bar-chart" aria-label="Ejecucion de nomina por sede">
          <div v-for="bar in payrollBars" :key="bar.label" class="bar-chart__item">
            <div class="bar-chart__track">
              <span :class="`bar-chart__bar bar-chart__bar--${bar.color}`" :style="{ height: `${bar.value}%` }"></span>
            </div>
            <small>{{ bar.label }}</small>
          </div>
        </div>
      </article>

      <article class="control-card distribution-card">
        <h2>Distribucion de Rol</h2>
        <dl>
          <div v-for="role in roleDistribution" :key="role.label">
            <dt>{{ role.label }}</dt>
            <dd :class="{ 'distribution-card__value--highlight': role.highlight }">{{ role.value }}</dd>
          </div>
        </dl>
      </article>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { CalendarDays, Download, ExternalLink } from 'lucide-vue-next'
import { controlStats, payrollBars, roleDistribution } from '@/data/dashboard'
import { meService, type MyModuleAccess } from '@/services/meService'

const myModules = ref<MyModuleAccess[]>([])
const modulesLoading = ref(true)
const modulesError = ref('')

onMounted(async () => {
  try {
    myModules.value = await meService.myModules()
  } catch (err) {
    modulesError.value = err instanceof Error ? err.message : 'No se pudieron cargar tus modulos'
  } finally {
    modulesLoading.value = false
  }
})
</script>
