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

import { ApiError } from '@/services/httpClient'
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

// A user-view-only account still needs roles and org units for the Users tab
// (role names, assign dialog), but the API may refuse them. A 403 there means
// "nothing to offer", not a broken page, so it degrades to an empty list.
const emptyOnForbidden = <T,>(promise: Promise<T[]>): Promise<T[]> =>
  promise.catch((err) => {
    if (err instanceof ApiError && err.status === 403) return []
    throw err
  })

const fetchRoles = () =>
  canViewRoles.value
    ? securityService.listRoles()
    : emptyOnForbidden(securityService.listRoles())

const loadAll = async () => {
  // `loading` only covers the first load. A reload (after creating a user,
  // say) must not swap the tabs for the loading message: that unmounts them,
  // KeepAlive cache and all, and the tab comes back with its selection,
  // search and filter reset — the user just created is no longer selected.
  loadError.value = ''

  try {
    // Modules only feed the Roles tab.
    const modulesPromise: Promise<ModuleWithPermissions[]> =
      canViewRoles.value
        ? securityService.listModules()
        : Promise.resolve([])
    const rolesPromise = fetchRoles()
    const orgUnitsPromise = emptyOnForbidden(securityService.listOrgUnits())

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
    const rolesPromise = fetchRoles()

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