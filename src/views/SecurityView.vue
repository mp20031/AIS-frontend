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

    <p v-if="actionError && !creatingRole && !assigningRole" class="login-card__error">{{ actionError }}</p>
    <p v-if="loadError" class="login-card__error">{{ loadError }}</p>

    <p v-if="loading">Cargando roles y permisos...</p>

    <!-- ================= ROLES TAB ================= -->
    <section v-else-if="activeTab === 'roles'" class="security-layout">
      <aside v-auto-animate class="roles-panel">
        <button
          v-for="role in roles"
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

        <button v-if="canManageRoles" class="role-row role-row--new" type="button" @click="startCreateRole">
          <span><strong>+ Nuevo Rol</strong></span>
        </button>
      </aside>

      <div v-if="selectedRole" class="security-main">
        <div class="security-card security-card--hero">
          <div>
            <h2>{{ selectedRole.name }}</h2>
            <p>{{ selectedRole.description || 'Sin descripcion' }}</p>
          </div>
          <div class="security-card__actions">
            <button v-if="canManageRoles" class="btn" type="button" @click="handleDeleteRole">Eliminar Rol</button>
            <button v-if="canManageRoles" class="btn btn--primary" type="button" :disabled="!isDirty || saving" @click="handleSave">
              {{ saving ? 'Guardando...' : 'Guardar Cambios' }}
            </button>
          </div>
        </div>

        <p v-if="savedMessage" class="save-toast">{{ savedMessage }}</p>

        <div class="permissions-grid">
          <section class="security-card">
            <h3>Permisos por Modulo</h3>
            <p>Marca los permisos concretos (`&lt;modulo&gt;.&lt;recurso&gt;.&lt;accion&gt;`) que trae este rol.</p>

            <div v-for="module in modules" :key="module.id" class="module-permission-group">
              <h4>{{ module.name }}</h4>
              <ul class="toggle-list">
                <li v-for="permission in module.permissions" :key="permission.id">
                  <span>
                    {{ permission.code }}
                    <em v-if="permission.sensitive" class="sensitive-badge" title="Requiere privilegios elevados (FR-14)">sensible</em>
                  </span>
                  <button
                    class="switch"
                    :class="{ 'switch--on': stagedCodes.has(permission.code) }"
                    type="button"
                    :aria-label="`Activar ${permission.code}`"
                    :aria-pressed="stagedCodes.has(permission.code)"
                    @click="togglePermission(permission.code)"
                  ></button>
                </li>
              </ul>
            </div>
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

    <!-- ================= USERS TAB ================= -->
    <section v-else class="security-layout">
      <aside v-auto-animate class="roles-panel">
        <button
          v-for="subject in subjects"
          :key="subject.id"
          class="role-row"
          :class="{ 'role-row--active': subject.id === selectedSubjectId }"
          type="button"
          @click="selectedSubjectId = subject.id"
        >
          <span>
            <strong>{{ subject.username }}</strong>
            <small>{{ subject.display_name || subject.email || 'Sin nombre' }}</small>
          </span>
          <em>{{ subject.active_grant_count }}</em>
        </button>
      </aside>

      <div v-if="selectedSubject" class="security-main">
        <div class="security-card security-card--hero">
          <div>
            <h2>{{ selectedSubject.username }}</h2>
            <p>{{ selectedSubject.display_name || 'Sin nombre' }} · {{ selectedSubject.email || 'sin correo' }}</p>
          </div>
          <div class="security-card__actions">
            <button v-if="canCreateGrants" class="btn btn--primary" type="button" @click="startAssignRole">+ Asignar Rol</button>
          </div>
        </div>

        <section class="security-card">
          <h3>Roles Asignados</h3>
          <p>Cada fila es un otorgamiento (SUBJECT + ROLE + ORG_UNIT) — revocar cierra la fila, nunca se edita.</p>
          <p v-if="subjectGrantsLoading">Cargando otorgamientos...</p>
          <ul v-else-if="subjectGrants.length" v-auto-animate class="grants-list">
            <li v-for="grant in subjectGrants" :key="grant.id">
              <div>
                <strong>{{ grant.role_name }}</strong>
                <small>{{ grant.org_unit_name }}<span v-if="grant.inherit_down"> (+ descendientes)</span></small>
              </div>
              <div class="grants-list__actions">
                <em :class="`effect-pill effect-pill--${grant.effect}`">{{ grant.effect }}</em>
                <button v-if="canRevokeGrants" class="btn btn--ghost" type="button" @click="handleRevokeGrant(grant.id)">Revocar</button>
              </div>
            </li>
          </ul>
          <p v-else class="security-card__empty">Este usuario no tiene ningun rol asignado actualmente.</p>
        </section>
      </div>
    </section>

    <!-- ================= MODALS ================= -->
    <Teleport to="body">
      <div v-if="creatingRole" class="modal-backdrop" @click.self="cancelCreateRole">
        <form class="modal-card" @submit.prevent="confirmCreateRole">
          <h2>Nuevo Rol</h2>
          <p>Crea un rol vacio - luego asignale permisos desde el panel.</p>

          <label>
            <span>Nombre del rol</span>
            <input ref="newRoleInput" v-model="newRoleName" type="text" placeholder="p. ej. Auditor" maxlength="60" />
          </label>

          <p v-if="actionError" class="login-card__error">{{ actionError }}</p>

          <div class="modal-card__actions">
            <button class="btn" type="button" @click="cancelCreateRole">Cancelar</button>
            <button class="btn btn--primary" type="submit">Crear Rol</button>
          </div>
        </form>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="assigningRole" class="modal-backdrop" @click.self="cancelAssignRole">
        <form class="modal-card" @submit.prevent="confirmAssignRole">
          <h2>Asignar Rol a {{ selectedSubject?.username }}</h2>
          <p>Crea un nuevo otorgamiento (GRANT) para este sujeto.</p>

          <label>
            <span>Rol</span>
            <select ref="assignRoleSelect" v-model="assignForm.roleId">
              <option v-for="role in roles" :key="role.id" :value="role.id">{{ role.name }}</option>
            </select>
          </label>

          <label>
            <span>Ambito (unidad organizacional)</span>
            <select v-model="assignForm.orgUnitId">
              <option v-for="unit in orgUnits" :key="unit.id" :value="unit.id">
                {{ '— '.repeat(orgUnitDepth(unit)) }}{{ unit.name }}
              </option>
            </select>
          </label>

          <label class="settings-form__switch">
            <span>Aplica a subunidades (inherit_down)</span>
            <button
              class="switch"
              :class="{ 'switch--on': assignForm.inheritDown }"
              type="button"
              aria-label="Aplica a subunidades"
              :aria-pressed="assignForm.inheritDown"
              @click="assignForm.inheritDown = !assignForm.inheritDown"
            ></button>
          </label>

          <label>
            <span>Efecto</span>
            <select v-model="assignForm.effect">
              <option value="allow">allow</option>
              <option value="deny">deny</option>
            </select>
          </label>

          <p v-if="actionError" class="login-card__error">{{ actionError }}</p>

          <div class="modal-card__actions">
            <button class="btn" type="button" @click="cancelAssignRole">Cancelar</button>
            <button class="btn btn--primary" type="submit">Asignar</button>
          </div>
        </form>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  securityService,
  type GrantOut,
  type ModuleWithPermissions,
  type OrgUnitOut,
  type RoleOut,
  type SubjectOut,
} from '@/services/securityService'
import { useSession } from '@/composables/useSession'

// UI gating only — every one of these endpoints re-checks the permission
// server-side, so hiding a button is a courtesy, never the control.
const { can } = useSession()
const canManageRoles = computed(() => can('iam.role.manage'))
const canCreateGrants = computed(() => can('iam.grant.create'))
const canRevokeGrants = computed(() => can('iam.grant.revoke'))

type Tab = 'roles' | 'users'
const activeTab = ref<Tab>('roles')

const modules = ref<ModuleWithPermissions[]>([])
const roles = ref<RoleOut[]>([])
const subjects = ref<SubjectOut[]>([])
const orgUnits = ref<OrgUnitOut[]>([])

const loading = ref(true)
const loadError = ref('')
const actionError = ref('')
const saving = ref(false)

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
    if (!selectedRoleId.value && rolesRes.length) selectedRoleId.value = rolesRes[0].id
    if (!selectedSubjectId.value && subjectsRes.length) selectedSubjectId.value = subjectsRes[0].id
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : 'No se pudieron cargar los roles y permisos'
  } finally {
    loading.value = false
  }
}

onMounted(loadAll)

const orgUnitDepth = (unit: OrgUnitOut) => (unit.path ? unit.path.split('.').length - 1 : 0)

// ---------------- Roles & permissions ----------------

const selectedRoleId = ref<string | null>(null)
const selectedRole = computed(() => roles.value.find((role) => role.id === selectedRoleId.value) ?? null)

const stagedCodes = ref<Set<string>>(new Set())
const isDirty = computed(() => {
  if (!selectedRole.value) return false
  const original = new Set(selectedRole.value.permission_codes)
  if (original.size !== stagedCodes.value.size) return true
  for (const code of original) if (!stagedCodes.value.has(code)) return true
  return false
})

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

watch(selectedRole, (role) => {
  actionError.value = ''
  savedMessage.value = ''
  stagedCodes.value = new Set(role?.permission_codes ?? [])
  if (role) loadRoleGrants(role.id)
})

const togglePermission = (code: string) => {
  const next = new Set(stagedCodes.value)
  if (next.has(code)) next.delete(code)
  else next.add(code)
  stagedCodes.value = next
}

const creatingRole = ref(false)
const newRoleName = ref('')
const newRoleInput = ref<HTMLInputElement | null>(null)

const startCreateRole = () => {
  creatingRole.value = true
  newRoleName.value = ''
  actionError.value = ''
  nextTick(() => newRoleInput.value?.focus())
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
    const role = await securityService.createRole(name)
    roles.value.push(role)
    selectedRoleId.value = role.id
    creatingRole.value = false
    actionError.value = ''
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : 'No se pudo crear el rol'
  }
}

const handleDeleteRole = async () => {
  if (!selectedRole.value) return
  if (!window.confirm(`¿Eliminar el rol "${selectedRole.value.name}"? Esta accion no se puede deshacer.`)) return

  try {
    await securityService.deleteRole(selectedRole.value.id)
    const removedId = selectedRole.value.id
    roles.value = roles.value.filter((role) => role.id !== removedId)
    selectedRoleId.value = roles.value[0]?.id ?? null
    actionError.value = ''
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : 'No se pudo eliminar el rol'
  }
}

const savedMessage = ref('')
let savedTimeout: number | undefined

const handleSave = async () => {
  if (!selectedRole.value) return
  saving.value = true
  actionError.value = ''
  try {
    const updated = await securityService.replaceRolePermissions(selectedRole.value.id, [...stagedCodes.value])
    const index = roles.value.findIndex((role) => role.id === updated.id)
    if (index !== -1) roles.value[index] = updated
    savedMessage.value = `Cambios guardados para "${updated.name}".`
    window.clearTimeout(savedTimeout)
    savedTimeout = window.setTimeout(() => {
      savedMessage.value = ''
    }, 2500)
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : 'No se pudieron guardar los cambios'
  } finally {
    saving.value = false
  }
}

// ---------------- Users & grants ----------------

const selectedSubjectId = ref<string | null>(null)
const selectedSubject = computed(() => subjects.value.find((s) => s.id === selectedSubjectId.value) ?? null)

const subjectGrants = ref<GrantOut[]>([])
const subjectGrantsLoading = ref(false)

const loadSubjectGrants = async (subjectId: string) => {
  subjectGrantsLoading.value = true
  try {
    subjectGrants.value = await securityService.listGrants({ subjectId })
  } catch {
    subjectGrants.value = []
  } finally {
    subjectGrantsLoading.value = false
  }
}

watch(selectedSubject, (subject) => {
  actionError.value = ''
  if (subject) loadSubjectGrants(subject.id)
})

const assigningRole = ref(false)
const assignRoleSelect = ref<HTMLSelectElement | null>(null)
const assignForm = ref({
  roleId: '',
  orgUnitId: '',
  inheritDown: false,
  effect: 'allow' as 'allow' | 'deny',
})

const startAssignRole = () => {
  assigningRole.value = true
  actionError.value = ''
  assignForm.value = {
    roleId: roles.value[0]?.id ?? '',
    orgUnitId: orgUnits.value[0]?.id ?? '',
    inheritDown: false,
    effect: 'allow',
  }
  nextTick(() => assignRoleSelect.value?.focus())
}

const cancelAssignRole = () => {
  assigningRole.value = false
  actionError.value = ''
}

const confirmAssignRole = async () => {
  if (!selectedSubject.value) return
  if (!assignForm.value.roleId || !assignForm.value.orgUnitId) {
    actionError.value = 'Selecciona un rol y un ambito.'
    return
  }
  try {
    await securityService.createGrant({
      subject_id: selectedSubject.value.id,
      role_id: assignForm.value.roleId,
      org_unit_id: assignForm.value.orgUnitId,
      inherit_down: assignForm.value.inheritDown,
      effect: assignForm.value.effect,
    })
    assigningRole.value = false
    actionError.value = ''
    await Promise.all([loadSubjectGrants(selectedSubject.value.id), refreshCounts()])
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : 'No se pudo asignar el rol'
  }
}

const handleRevokeGrant = async (grantId: string) => {
  if (!selectedSubject.value) return
  if (!window.confirm('¿Revocar este otorgamiento?')) return
  try {
    await securityService.revokeGrant(grantId)
    await Promise.all([loadSubjectGrants(selectedSubject.value.id), refreshCounts()])
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : 'No se pudo revocar el otorgamiento'
  }
}

const refreshCounts = async () => {
  const [rolesRes, subjectsRes] = await Promise.all([securityService.listRoles(), securityService.listSubjects()])
  roles.value = rolesRes
  subjects.value = subjectsRes
}

// ---------------- Shared: Esc closes any open modal ----------------

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Escape') return
  if (creatingRole.value) cancelCreateRole()
  if (assigningRole.value) cancelAssignRole()
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
</script>
