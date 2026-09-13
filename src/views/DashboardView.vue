<template>
  <PortalLayout>
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

    <section class="control-card module-status-card">
      <div class="control-card__title">
        <h2>Estado de Modulos</h2>
        <span>Vista consolidada del hub institucional</span>
      </div>

      <div class="module-status-grid">
        <article v-for="module in moduleStatuses" :key="module.name" class="module-status">
          <h3>
            <span :class="`status-dot status-dot--${module.tone}`"></span>
            {{ module.name }}
            <ExternalLink :size="12" />
          </h3>
          <strong :class="`status-pill status-pill--${module.tone}`">{{ module.status }}</strong>
          <p>{{ module.detail }}</p>
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
  </PortalLayout>
</template>

<script setup>
import { CalendarDays, Download, ExternalLink } from 'lucide-vue-next'
import PortalLayout from '@/layouts/PortalLayout.vue'
import { controlStats, moduleStatuses, payrollBars, roleDistribution } from '@/data/dashboard'
</script>
