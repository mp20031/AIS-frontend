<template>
  <div v-auto-animate class="security-view">
    <section class="console-heading">
      <div>
        <h1>Seguridad · Roles y Permisos</h1>
        <p>Define que puede ver y hacer cada rol dentro del portal</p>
      </div>
    </section>

    <div class="tab-bar">
      <button class="tab-bar__item" :class="{ 'tab-bar__item--active': activeTab === 'roles' }" type="button" @click="activeTab = 'roles'">
        Roles y Permisos
      </button>
      <button class="tab-bar__item" :class="{ 'tab-bar__item--active': activeTab === 'users' }" type="button" @click="activeTab = 'users'">
        Usuarios
      </button>
    </div>

    <p v-if="loadError" class="login-card__error">{{ loadError }}</p>

    <p v-if="loading">Cargando roles y permisos...</p>

    <!-- KeepAlive so switching tabs keeps each one's selection and page. -->
    <KeepAlive v-else>
      <RolesTab v-if="activeTab === 'roles'" v-model:roles="roles" :modules="modules" />
      <UsersTab v-else :subjects="subjects" :roles="roles" :org-units="orgUnits" @grants-changed="refreshCounts" />
    </KeepAlive>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import {
  securityService,
  type ModuleWithPermissions,
  type OrgUnitOut,
  type RoleOut,
  type SubjectOut,
} from '@/services/securityService'
import RolesTab from '@/components/security/RolesTab.vue'
import UsersTab from '@/components/security/UsersTab.vue'

type Tab = 'roles' | 'users'
const activeTab = ref<Tab>('roles')

// Loaded once here because both tabs read them: the Users tab offers the
// roles and org units when assigning, and both show live grant counts.
const modules = ref<ModuleWithPermissions[]>([])
const roles = ref<RoleOut[]>([])
const subjects = ref<SubjectOut[]>([])
const orgUnits = ref<OrgUnitOut[]>([])

const loading = ref(true)
const loadError = ref('')

const loadAll = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const [modulesRes, rolesRes, subjectsRes, orgUnitsRes] = await Promise.all([
      securityService.listModules(),
      securityService.listRoles(),
      securityService.listSubjects(),
      securityService.listOrgUnits(),
    ])
    modules.value = modulesRes
    roles.value = rolesRes
    subjects.value = subjectsRes
    orgUnits.value = orgUnitsRes.sort((a, b) => (a.path ?? '').localeCompare(b.path ?? ''))
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : 'No se pudieron cargar los roles y permisos'
  } finally {
    loading.value = false
  }
}

onMounted(loadAll)

const refreshCounts = async () => {
  try {
    const [rolesRes, subjectsRes] = await Promise.all([securityService.listRoles(), securityService.listSubjects()])
    roles.value = rolesRes
    subjects.value = subjectsRes
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : 'No se pudieron actualizar los conteos'
  }
}
</script>
