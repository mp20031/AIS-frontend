<template>
  <div v-auto-animate class="security-view">
    <section class="console-heading">
      <div>
        <h1>{{ heading.title }}</h1>
        <p>{{ heading.description }}</p>
      </div>
    </section>

    <div class="tab-bar">
      <button
        v-if="canViewRoles"
        class="tab-bar__item"
        :class="{ 'tab-bar__item--active': activeTab === 'roles' }"
        type="button"
        @click="activeTab = 'roles'"
      >
        Roles y Permisos
      </button>

      <button
        v-if="canViewUsers"
        class="tab-bar__item"
        :class="{ 'tab-bar__item--active': activeTab === 'users' }"
        type="button"
        @click="activeTab = 'users'"
      >
        Usuarios
      </button>
    </div>

    <p v-if="loadError" class="login-card__error">
      {{ loadError }}
    </p>

    <p v-if="loading">
      {{ loadingMessage }}
    </p>

    <KeepAlive v-else>
      <RolesTab
        v-if="activeTab === 'roles'"
        v-model:roles="roles"
        :modules="modules"
      />

      <UsersTab
        v-else-if="activeTab === 'users'"
        :subjects="subjects"
        :roles="roles"
        :org-units="orgUnits"
        @grants-changed="refreshCounts"
        @subjects-changed="loadAll"
      />
    </KeepAlive>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import {
  securityService,
  type ModuleWithPermissions,
  type OrgUnitOut,
  type RoleOut,
  type SubjectOut,
} from '@/services/securityService'

import { useSession } from '@/composables/useSession'
import { PERMISSIONS } from '@/config/permissions'

import RolesTab from '@/components/security/RolesTab.vue'
import UsersTab from '@/components/security/UsersTab.vue'

type Tab = 'roles' | 'users'

const { can } = useSession()

const canViewRoles = computed(() =>
  can(PERMISSIONS.IAM_ROLE_MANAGE),
)

const canViewUsers = computed(() =>
  can(PERMISSIONS.IAM_USER_VIEW),
)

const activeTab = ref<Tab | null>(null)

const heading = computed(() => {
  if (activeTab.value === 'users') {
    return {
      title: 'Seguridad · Usuarios',
      description:
        'Administra usuarios, asignaciones de roles y ambitos activos',
    }
  }

  return {
    title: 'Seguridad · Roles y Permisos',
    description:
      'Define que puede ver y hacer cada rol dentro del portal',
  }
})

const loadingMessage = computed(() => {
  if (activeTab.value === 'users') {
    return 'Cargando usuarios...'
  }

  return 'Cargando roles y permisos...'
})

const modules = ref<ModuleWithPermissions[]>([])
const roles = ref<RoleOut[]>([])
const subjects = ref<SubjectOut[]>([])
const orgUnits = ref<OrgUnitOut[]>([])

const loading = ref(true)
const loadError = ref('')

const setInitialTab = () => {
  if (canViewRoles.value) {
    activeTab.value = 'roles'
    return
  }

  if (canViewUsers.value) {
    activeTab.value = 'users'
  }
}

const loadAll = async () => {
  loading.value = true
  loadError.value = ''

  try {
    const modulesPromise = securityService.listModules()
    const rolesPromise = securityService.listRoles()
    const orgUnitsPromise = securityService.listOrgUnits()

    const subjectsPromise: Promise<SubjectOut[]> =
      canViewUsers.value
        ? securityService.listSubjects()
        : Promise.resolve([])

    const [
      modulesRes,
      rolesRes,
      subjectsRes,
      orgUnitsRes,
    ] = await Promise.all([
      modulesPromise,
      rolesPromise,
      subjectsPromise,
      orgUnitsPromise,
    ])

    modules.value = modulesRes
    roles.value = rolesRes
    subjects.value = subjectsRes

    orgUnits.value = orgUnitsRes.sort((a, b) =>
      (a.path ?? '').localeCompare(b.path ?? ''),
    )
  } catch (err) {
    loadError.value =
      err instanceof Error
        ? err.message
        : 'No se pudieron cargar los datos de seguridad'
  } finally {
    loading.value = false
  }
}

const refreshCounts = async () => {
  try {
    const rolesPromise = securityService.listRoles()

    const subjectsPromise: Promise<SubjectOut[]> =
      canViewUsers.value
        ? securityService.listSubjects()
        : Promise.resolve([])

    const [
      rolesRes,
      subjectsRes,
    ] = await Promise.all([
      rolesPromise,
      subjectsPromise,
    ])

    roles.value = rolesRes
    subjects.value = subjectsRes
  } catch (err) {
    loadError.value =
      err instanceof Error
        ? err.message
        : 'No se pudieron actualizar los conteos'
  }
}

onMounted(async () => {
  setInitialTab()
  await loadAll()
})
</script>