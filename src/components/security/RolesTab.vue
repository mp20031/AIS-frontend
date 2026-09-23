<template>
  <div>
    <p v-if="actionError && !creatingRole" class="login-card__error">{{ actionError }}</p>

    <section class="security-layout">
      <aside class="roles-panel">
        <label class="roles-search">
          <Search :size="15" aria-hidden="true" />
          <input
            v-model="search"
            type="search"
            placeholder="Buscar rol..."
            aria-label="Buscar rol por nombre o descripcion"
            @keydown.enter.prevent="selectFirstMatch"
            @keydown.esc.stop="search = ''"
          />
        </label>

        <p v-if="!filteredRoles.length" class="roles-search__empty">Ningun rol coincide con "{{ search.trim() }}".</p>

        <div v-auto-animate class="roles-panel__list">
          <button
            v-for="role in pagedRoles"
            :key="role.id"
            class="role-row"
            :class="{ 'role-row--active': role.id === selectedRoleId }"
            type="button"
            @click="selectedRoleId = role.id"
          >
            <span>
              <strong>{{ role.name }}</strong>
              <small>{{ role.description || 'Sin descripcion' }}</small>
            </span>
            <em>{{ role.active_grant_count }}</em>
          </button>
        </div>

        <button v-if="canManageRoles" class="role-row role-row--new" type="button" @click="startCreateRole">
          <span><strong>+ Nuevo Rol</strong></span>
        </button>

        <nav v-if="rolePageCount > 1" class="pager" aria-label="Paginas de roles">
          <button class="pager__btn" type="button" aria-label="Pagina anterior" :disabled="rolePage === 1" @click="rolePage--">
            <ChevronLeft :size="16" />
          </button>
          <span>{{ rolePage }} / {{ rolePageCount }}</span>
          <button class="pager__btn" type="button" aria-label="Pagina siguiente" :disabled="rolePage === rolePageCount" @click="rolePage++">
            <ChevronRight :size="16" />
          </button>
        </nav>
      </aside>

      <div v-if="selectedRole" class="security-main">
        <div class="security-card security-card--hero">
          <div>
            <h2>{{ selectedRole.name }}</h2>
            <p>{{ selectedRole.description || 'Sin descripcion' }}</p>
          </div>
          <div class="security-card__actions">
            <button v-if="canManageRoles" class="btn btn--danger-quiet" type="button" @click="handleDeleteRole">Eliminar Rol</button>
          </div>
        </div>

        <Transition name="toast">
          <p v-if="savedMessage" class="save-toast">{{ savedMessage }}</p>
        </Transition>

        <div class="permissions-grid">
          <section class="security-card">
            <h3>Permisos por Modulo</h3>
            <p>Abre un modulo para ver o cambiar los permisos (`&lt;modulo&gt;.&lt;recurso&gt;.&lt;accion&gt;`) que trae este rol.</p>

            <ul class="module-summary-list">
              <li v-for="module in modules" :key="module.id">
                <button class="module-summary" type="button" @click="openModuleEditor(module)">
                  <span>
                    <strong>{{ module.name }}</strong>
                    <small>{{ grantedInModule(module) }} de {{ module.permissions.length }} permisos</small>
                  </span>
                  <span class="module-summary__action">
                    {{ canManageRoles ? 'Editar' : 'Ver' }}
                    <ChevronRight :size="14" />
                  </span>
                </button>
              </li>
            </ul>
          </section>

          <section class="security-card">
            <h3>Otorgamientos Activos</h3>
            <p>Sujetos que hoy tienen este rol — la cadena SUBJECT → GRANT → ROLE en vivo.</p>
            <p v-if="roleGrantsLoading">Cargando otorgamientos...</p>
            <ul v-else-if="roleGrants.length" v-auto-animate class="grants-list">
              <li v-for="grant in roleGrants" :key="grant.id">
                <div>
                  <strong>{{ grant.subject_username }}</strong>
                  <small>{{ grant.org_unit_name }}<span v-if="grant.inherit_down"> (+ descendientes)</span></small>
                </div>
                <em :class="`effect-pill effect-pill--${grant.effect}`">{{ grant.effect }}</em>
              </li>
            </ul>
            <p v-else class="security-card__empty">Ningun sujeto tiene este rol activo actualmente.</p>
          </section>
        </div>
      </div>
    </section>

    <ModulePermissionsModal
      :open="moduleEditorOpen"
      :role="selectedRole"
      :module="editingModule"
      :can-manage="canManageRoles"
      @close="moduleEditorOpen = false"
      @saved="handleModuleSaved"
    />

    <BaseModal
      :open="creatingRole"
      title="Nuevo Rol"
      description="Crea un rol vacio - luego asignale permisos desde el panel."
      @close="cancelCreateRole"
      @submit="confirmCreateRole"
    >
      <label>
        <span>Nombre del rol</span>
        <input v-model="newRoleName" type="text" placeholder="p. ej. Auditor" maxlength="60" data-autofocus />
      </label>

      <label>
        <span>Descripcion <small>(opcional)</small></span>
        <textarea v-model="newRoleDescription" rows="3" placeholder="p. ej. Consulta la bitacora sin poder modificar nada" maxlength="300"></textarea>
      </label>

      <p v-if="actionError" class="login-card__error">{{ actionError }}</p>

      <template #actions>
        <button class="btn" type="button" @click="cancelCreateRole">Cancelar</button>
        <button class="btn btn--primary" type="submit">Crear Rol</button>
      </template>
    </BaseModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight, Search } from 'lucide-vue-next'
import { securityService, type GrantOut, type ModuleWithPermissions, type RoleOut } from '@/services/securityService'
import { useSession } from '@/composables/useSession'
import { useConfirm } from '@/composables/useConfirm'
import BaseModal from '@/components/ui/BaseModal.vue'
import ModulePermissionsModal from '@/components/security/ModulePermissionsModal.vue'

defineProps<{ modules: ModuleWithPermissions[] }>()

// Shared with SecurityView: the Users tab offers these same roles when
// assigning one, so creating or deleting a role here must show up there.
const roles = defineModel<RoleOut[]>('roles', { required: true })

// UI gating only — every one of these endpoints re-checks the permission
// server-side, so hiding a button is a courtesy, never the control.
const { can } = useSession()
const canManageRoles = computed(() => can('iam.role.manage'))

const actionError = ref('')
const confirm = useConfirm()

const selectedRoleId = ref<string | null>(roles.value[0]?.id ?? null)
const selectedRole = computed(() => roles.value.find((role) => role.id === selectedRoleId.value) ?? null)

// ---------------- Search ----------------

// Client-side, like the paging: every role is already loaded. Case- and
// accent-insensitive, so "auditoria" finds "Auditoría".
const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

const search = ref('')
const filteredRoles = computed(() => {
  const query = normalize(search.value.trim())
  if (!query) return roles.value
  return roles.value.filter((role) => normalize(`${role.name} ${role.description ?? ''}`).includes(query))
})

// Enter jumps straight into the best match, so search → edit is one keystroke.
const selectFirstMatch = () => {
  const first = filteredRoles.value[0]
  if (first) selectedRoleId.value = first.id
}

// ---------------- Pagination ----------------

// The API returns every role in one call, so paging is purely a display
// concern: it keeps the panel a fixed height however many roles exist.
const ROLES_PER_PAGE = 6
const rolePage = ref(1)
const rolePageCount = computed(() => Math.max(1, Math.ceil(filteredRoles.value.length / ROLES_PER_PAGE)))
const pagedRoles = computed(() => {
  const start = (rolePage.value - 1) * ROLES_PER_PAGE
  return filteredRoles.value.slice(start, start + ROLES_PER_PAGE)
})

// Show the page holding the selection — so a newly created role (appended at
// the end) is on screen — or the first page when a search hides it.
// Watching the list too covers v-model's lag: a role created here is only in
// `roles` after the parent re-renders.
watch([selectedRoleId, filteredRoles], ([id]) => {
  const index = filteredRoles.value.findIndex((role) => role.id === id)
  rolePage.value = index === -1 ? 1 : Math.floor(index / ROLES_PER_PAGE) + 1
})
watch(rolePageCount, (count) => {
  if (rolePage.value > count) rolePage.value = count
})

// ---------------- Selected role ----------------

const roleGrants = ref<GrantOut[]>([])
const roleGrantsLoading = ref(false)

const loadRoleGrants = async (roleId: string) => {
  roleGrantsLoading.value = true
  try {
    roleGrants.value = await securityService.listGrants({ roleId })
  } catch {
    roleGrants.value = []
  } finally {
    roleGrantsLoading.value = false
  }
}

watch(selectedRoleId, () => {
  actionError.value = ''
  savedMessage.value = ''
})

// Reload on a new selection, and also when the grant count moves: grants are
// assigned and revoked from the Users tab, and this list must not go stale.
watch(
  () => [selectedRoleId.value, selectedRole.value?.active_grant_count],
  () => {
    if (selectedRoleId.value) loadRoleGrants(selectedRoleId.value)
  },
  { immediate: true },
)

const grantedInModule = (module: ModuleWithPermissions) => {
  const granted = new Set(selectedRole.value?.permission_codes ?? [])
  return module.permissions.filter((permission) => granted.has(permission.code)).length
}

// ---------------- Per-module editor ----------------

// `editingModule` outlives the modal (it's what the closing animation shows);
// `moduleEditorOpen` is what opens and closes it.
const editingModule = ref<ModuleWithPermissions | null>(null)
const moduleEditorOpen = ref(false)

const openModuleEditor = (module: ModuleWithPermissions) => {
  editingModule.value = module
  moduleEditorOpen.value = true
}

const savedMessage = ref('')
let savedTimeout: number | undefined

const handleModuleSaved = (updated: RoleOut) => {
  roles.value = roles.value.map((role) => (role.id === updated.id ? updated : role))
  moduleEditorOpen.value = false
  savedMessage.value = `Cambios guardados para "${updated.name}".`
  window.clearTimeout(savedTimeout)
  savedTimeout = window.setTimeout(() => {
    savedMessage.value = ''
  }, 2500)
}

// ---------------- Create / delete ----------------

const creatingRole = ref(false)
const newRoleName = ref('')
const newRoleDescription = ref('')

const startCreateRole = () => {
  creatingRole.value = true
  newRoleName.value = ''
  newRoleDescription.value = ''
  actionError.value = ''
}

const cancelCreateRole = () => {
  creatingRole.value = false
  actionError.value = ''
}


const confirmCreateRole = async () => {
  const name = newRoleName.value.trim()
  if (!name) {
    actionError.value = 'Ingresa un nombre para el nuevo rol.'
    return
  }
  try {
    const role = await securityService.createRole(name, newRoleDescription.value.trim() || undefined)
    roles.value = [...roles.value, role]
    search.value = '' // or a search that doesn't match would hide the new role
    selectedRoleId.value = role.id
    creatingRole.value = false
    actionError.value = ''
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : 'No se pudo crear el rol'
  }
}

const handleDeleteRole = async () => {
  // Captured up front: the selection could change while the dialog is open.
  const role = selectedRole.value
  if (!role) return
  const ok = await confirm({
    title: `¿Eliminar el rol "${role.name}"?`,
    message: 'Esta accion no se puede deshacer.',
    confirmLabel: 'Eliminar rol',
    tone: 'danger',
  })
  if (!ok) return

  try {
    await securityService.deleteRole(role.id)
    // Read from the local copy: through v-model, roles.value only reflects
    // the new array once the parent re-renders.
    const remaining = roles.value.filter((r) => r.id !== role.id)
    roles.value = remaining
    selectedRoleId.value = remaining[0]?.id ?? null
    actionError.value = ''
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : 'No se pudo eliminar el rol'
  }
}
</script>
