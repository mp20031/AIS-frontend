<template>
  <div>
    <p v-if="actionError && !assigningRole && !creatingSubject" class="login-card__error">{{ actionError }}</p>

    <section class="security-layout">
      <aside class="roles-panel">
        <label class="roles-search">
          <Search :size="15" aria-hidden="true" />
          <input
            v-model="subjectSearch"
            type="search"
            placeholder="Buscar usuario..."
            aria-label="Buscar usuario"
            @keydown.esc.stop="subjectSearch = ''"
          />
        </label>

        <label class="roles-filter">
          <span>Mostrar</span>
          <select v-model="statusFilter" aria-label="Filtrar usuarios por estado">
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
            <option value="all">Todos</option>
          </select>
        </label>

        <button
          v-if="canCreateSubjects"
          class="role-create-button"
          type="button"
          aria-label="Agregar usuario"
          title="Agregar usuario"
          @click="startCreateSubject"
        >
          <UserPlus :size="17" aria-hidden="true" />
        </button>

        <p v-if="!filteredSubjects.length" class="roles-search__empty">Ningun usuario coincide con "{{ subjectSearch.trim() }}".</p>

        <div v-auto-animate class="roles-panel__list">
          <button
            v-for="subject in pagedSubjects"
            :key="subject.id"
            class="role-row"
            :class="{
              'role-row--active': subject.id === selectedSubjectId,
              'role-row--inactive': !subject.active,
            }"
            type="button"
            @click="selectedSubjectId = subject.id"
          >
            <span>
              <strong>
                {{ subject.username }}
                <small v-if="!subject.active" class="role-row__status">Inactivo</small>
              </strong>
              <small>{{ subject.display_name || subject.email || 'Sin nombre' }}</small>
            </span>
            <em>{{ subject.active_grant_count }}</em>
          </button>
        </div>

        <nav v-if="subjectPageCount > 1" class="pager" aria-label="Paginas de usuarios">
          <button class="pager__btn" type="button" aria-label="Pagina anterior" :disabled="subjectPage === 1" @click="subjectPage--">
            <ChevronLeft :size="16" />
          </button>
          <span>{{ subjectPage }} / {{ subjectPageCount }}</span>
          <button
            class="pager__btn"
            type="button"
            aria-label="Pagina siguiente"
            :disabled="subjectPage === subjectPageCount"
            @click="subjectPage++"
          >
            <ChevronRight :size="16" />
          </button>
        </nav>
      </aside>

      <div v-if="selectedSubject" class="security-main">
        <div class="security-card security-card--hero">
          <div>
            <h2>{{ selectedSubject.username }}</h2>
            <p>{{ selectedSubject.display_name || 'Sin nombre' }} · {{ selectedSubject.email || 'sin correo' }}</p>
            <dl class="role-meta">
              <div>
                <dt>Roles</dt>
                <dd>{{ selectedSubject.active_grant_count }}</dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>{{ selectedSubject.active ? 'Activo' : 'Inactivo' }}</dd>
              </div>
            </dl>
          </div>
          <div class="security-card__actions">
            <button v-if="canCreateGrants" class="btn btn--primary icon-action" type="button" aria-label="Asignar rol" title="Asignar rol" @click="startAssignRole">
              <ShieldPlus :size="16" aria-hidden="true" />
            </button>
            <button v-if="canUpdateSubjects && !isOwnSubject" class="btn btn--soft icon-action" type="button" aria-label="Editar usuario" title="Editar usuario" @click="startEditSubject">
              <Pencil :size="16" aria-hidden="true" />
            </button>
            <button
              v-if="canUpdateSubjects && !isOwnSubject"
              class="btn btn--danger-quiet icon-action"
              type="button"
              :aria-label="selectedSubject.active ? 'Desactivar usuario' : 'Reactivar usuario'"
              :title="selectedSubject.active ? 'Desactivar usuario' : 'Reactivar usuario'"
              @click="handleToggleSubject"
            >
              <UserX v-if="selectedSubject.active" :size="16" aria-hidden="true" />
              <UserCheck v-else :size="16" aria-hidden="true" />
            </button>
          </div>
        </div>

        <section class="security-card">
          <div class="security-card__title">
            <div>
              <h3>Roles Asignados</h3>
              <p>Cada fila es un otorgamiento activo para este usuario.</p>
            </div>
            <div class="user-card-actions">
              <span>{{ subjectGrants.length }}</span>
              <button
                v-if="canRevokeGrants && subjectGrants.length"
                class="btn btn--soft icon-action"
                type="button"
                aria-label="Revocar todos los roles"
                title="Revocar todos"
                @click="handleRevokeAllGrants"
              >
                <RotateCcw :size="15" aria-hidden="true" />
              </button>
            </div>
          </div>

          <p v-if="subjectGrantsLoading">Cargando otorgamientos...</p>
          <ul v-else-if="subjectGrants.length" v-auto-animate class="grants-list">
            <li v-for="grant in subjectGrants" :key="grant.id">
              <div>
                <strong>{{ grant.role_name }}</strong>
                <small>{{ grant.org_unit_name }}<span v-if="grant.inherit_down"> (+ descendientes)</span></small>
              </div>
              <div class="grants-list__actions">
                <em :class="`effect-pill effect-pill--${grant.effect}`">{{ grant.effect }}</em>
                <button
                  v-if="canRevokeGrants"
                  class="btn btn--ghost icon-action icon-action--subtle"
                  type="button"
                  aria-label="Revocar rol"
                  title="Revocar"
                  @click="handleRevokeGrant(grant.id)"
                >
                  <X :size="15" aria-hidden="true" />
                </button>
              </div>
            </li>
          </ul>
          <p v-else class="security-card__empty">Este usuario no tiene ningun rol asignado actualmente.</p>
        </section>
      </div>
    </section>

    <BaseModal
      :open="creatingSubject"
      title="Nuevo Usuario"
      description="Crea un sujeto para poder asignarle roles dentro del portal."
      @close="cancelCreateSubject"
      @submit="confirmCreateSubject"
    >
      <div class="user-form-intro">
        <div class="user-form-intro__icon">
          <UserPlus :size="20" aria-hidden="true" />
        </div>
        <div>
          <strong>Datos del usuario</strong>
          <span>Completa sus datos y asigna su primer rol.</span>
        </div>
      </div>

      <div class="user-form-grid">
        <label>
          <span>Usuario</span>
          <input v-model="newSubject.username" type="text" placeholder="p. ej. jperez" maxlength="80" data-autofocus />
          <small>Identificador unico para iniciar o asociar permisos.</small>
        </label>

        <label>
          <span>Nombre</span>
          <input v-model="newSubject.displayName" type="text" placeholder="p. ej. Juan Perez" maxlength="120" />
          <small>Nombre visible dentro de la consola.</small>
        </label>

        <label class="user-form-grid__wide">
          <span>Correo</span>
          <input v-model="newSubject.email" type="email" placeholder="p. ej. jperez@colegio.edu" maxlength="180" />
          <small>Opcional, pero recomendado para identificar cuentas.</small>
        </label>

        <section class="user-form-role user-form-grid__wide">
          <div class="user-form-role__header">
            <strong>Rol inicial</strong>
            <span>Opcional, pero recomendado para dejarlo listo.</span>
          </div>

          <div class="user-form-role__grid">
            <div class="modal-field">
              <span :id="`${fieldId}-new-role`">Rol</span>
              <BaseSelect v-model="newSubject.roleId" :options="optionalRoleOptions" :aria-labelledby="`${fieldId}-new-role`" />
            </div>

            <div class="modal-field">
              <span :id="`${fieldId}-new-unit`">Ambito</span>
              <BaseSelect v-model="newSubject.orgUnitId" :options="orgUnitOptions" :aria-labelledby="`${fieldId}-new-unit`" />
            </div>

            <label class="settings-form__switch user-form-role__switch user-form-role__switch--card">
              <span>
                <strong>Subunidades</strong>
                <small>Incluye unidades hijas</small>
              </span>
              <button
                class="switch"
                :class="{ 'switch--on': newSubject.inheritDown }"
                type="button"
                aria-label="Aplica a subunidades"
                :aria-pressed="newSubject.inheritDown"
                @click="newSubject.inheritDown = !newSubject.inheritDown"
              ></button>
            </label>
          </div>

          <div v-if="newSubject.roleId" class="role-permission-preview" :title="newSubjectPermissionTooltip">
            <ShieldPlus :size="14" aria-hidden="true" />
            <span>{{ newSubjectPermissionCount }} permisos incluidos</span>
          </div>
        </section>
      </div>

      <p v-if="actionError" class="login-card__error">{{ actionError }}</p>

      <template #actions>
        <button class="btn" type="button" @click="cancelCreateSubject">Cancelar</button>
        <button class="btn btn--primary" type="submit">Crear</button>
      </template>
    </BaseModal>

    <BaseModal
      :open="editingSubject"
      :title="`Editar usuario ${editTarget?.username ?? ''}`"
      description="Actualiza el nombre visible y el correo del usuario."
      @close="cancelEditSubject"
      @submit="confirmEditSubject"
    >
      <div class="user-form-grid">
        <label class="user-form-grid__wide">
          <span>Nombre</span>
          <input v-model="editForm.displayName" type="text" placeholder="p. ej. Juan Perez" maxlength="120" data-autofocus />
        </label>
        <label class="user-form-grid__wide">
          <span>Correo</span>
          <input v-model="editForm.email" type="email" placeholder="p. ej. jperez@colegio.edu" maxlength="180" :aria-invalid="Boolean(editEmailError)" />
          <small v-if="editEmailError" class="login-card__error">{{ editEmailError }}</small>
        </label>
      </div>
      <p v-if="editFormError" class="login-card__error">{{ editFormError }}</p>
      <template #actions>
        <button class="btn" type="button" @click="cancelEditSubject">Cancelar</button>
        <button class="btn btn--primary" type="submit">Guardar</button>
      </template>
    </BaseModal>

    <BaseModal
      :open="assigningRole"
      :title="`Asignar Rol a ${assignTarget?.username ?? ''}`"
      description="Crea un nuevo otorgamiento para este usuario."
      @close="cancelAssignRole"
      @submit="confirmAssignRole"
    >
      <div class="assign-role-grid">
        <div class="modal-field">
          <span :id="`${fieldId}-role`">Rol</span>
          <BaseSelect v-model="assignForm.roleId" :options="roleOptions" :aria-labelledby="`${fieldId}-role`" data-autofocus />
        </div>

        <div class="modal-field">
          <span :id="`${fieldId}-unit`">Ambito</span>
          <BaseSelect v-model="assignForm.orgUnitId" :options="orgUnitOptions" :aria-labelledby="`${fieldId}-unit`" />
        </div>

        <label class="settings-form__switch user-form-role__switch user-form-role__switch--card">
          <span>
            <strong>Subunidades</strong>
            <small>Incluye unidades hijas</small>
          </span>
          <button
            class="switch"
            :class="{ 'switch--on': assignForm.inheritDown }"
            type="button"
            aria-label="Aplica a subunidades"
            :aria-pressed="assignForm.inheritDown"
            @click="assignForm.inheritDown = !assignForm.inheritDown"
          ></button>
        </label>
      </div>

      <div v-if="assignForm.roleId" class="role-permission-preview" :title="assignPermissionTooltip">
        <ShieldPlus :size="14" aria-hidden="true" />
        <span>{{ assignPermissionCount }} permisos incluidos</span>
      </div>

      <div class="modal-field">
        <span :id="`${fieldId}-effect`">Efecto</span>
        <BaseSelect v-model="assignForm.effect" :options="effectOptions" :aria-labelledby="`${fieldId}-effect`" />
      </div>

      <p v-if="actionError" class="login-card__error">{{ actionError }}</p>

      <template #actions>
        <button class="btn" type="button" @click="cancelAssignRole">Cancelar</button>
        <button class="btn btn--primary" type="submit">Asignar</button>
      </template>
    </BaseModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { ChevronLeft, ChevronRight, Pencil, RotateCcw, Search, ShieldPlus, UserCheck, UserPlus, UserX, X } from 'lucide-vue-next'
import { toast } from 'vue3-toastify'
import { ApiError } from '@/services/httpClient'
import { securityService, type GrantOut, type OrgUnitOut, type RoleOut, type SubjectOut } from '@/services/securityService'
import { useSession } from '@/composables/useSession'
import { useConfirm } from '@/composables/useConfirm'
import { usePagination } from '@/composables/usePagination'
import { PERMISSIONS } from '@/config/permissions'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSelect, { type SelectOption } from '@/components/ui/BaseSelect.vue'

const props = defineProps<{
  subjects: SubjectOut[]
  roles: RoleOut[]
  orgUnits: OrgUnitOut[]
}>()

const emit = defineEmits<{ grantsChanged: []; subjectsChanged: [] }>()

const { can, user } = useSession()
const canCreateGrants = computed(() => can(PERMISSIONS.IAM_GRANT_CREATE))
const canRevokeGrants = computed(() => can(PERMISSIONS.IAM_GRANT_REVOKE))
const canCreateSubjects = computed(() => can(PERMISSIONS.IAM_USER_CREATE))
const canUpdateSubjects = computed(() => can(PERMISSIONS.IAM_USER_UPDATE))

const actionError = ref('')
const confirm = useConfirm()

const orgUnitDepth = (unit: OrgUnitOut) => (unit.path ? unit.path.split('.').length - 1 : 0)
const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

// ---------------- Selected user ----------------

const subjectSearch = ref('')
type StatusFilter = 'active' | 'inactive' | 'all'

const statusFilter = ref<StatusFilter>('active')
const selectedSubjectId = ref<string | null>(props.subjects.find((subject) => subject.active)?.id ?? null)
const selectedSubject = computed(() => props.subjects.find((s) => s.id === selectedSubjectId.value) ?? null)
const isOwnSubject = computed(() => {
  const subject = selectedSubject.value
  const currentUser = user.value
  if (!subject || !currentUser) return false

  return subject.id === currentUser.id || subject.username === currentUser.username
})
const filteredSubjects = computed(() => {
  const query = normalize(subjectSearch.value.trim())
  return props.subjects.filter((subject) => {
    const matchesStatus =
      statusFilter.value === 'all' ||
      (statusFilter.value === 'active' ? subject.active : !subject.active)
    if (!matchesStatus) return false

    if (!query) return true
    return normalize(`${subject.username} ${subject.display_name ?? ''} ${subject.email ?? ''}`).includes(query)
  })
})

// Same paging as the roles list: 6 per page, following the selection.
const SUBJECTS_PER_PAGE = 6
const {
  page: subjectPage,
  pageCount: subjectPageCount,
  pagedItems: pagedSubjects,
} = usePagination(filteredSubjects, selectedSubjectId, SUBJECTS_PER_PAGE)

const subjectGrants = ref<GrantOut[]>([])
const subjectGrantsLoading = ref(false)

const loadSubjectGrants = async (subjectId: string) => {
  subjectGrantsLoading.value = true

  try {
    subjectGrants.value =
      await securityService.listGrants({ subjectId })
  } catch (err) {
    subjectGrants.value = []

    actionError.value =
      err instanceof Error
        ? err.message
        : 'No se pudieron cargar los otorgamientos'
  } finally {
    subjectGrantsLoading.value = false
  }
}

watch(
  selectedSubjectId,
  (id) => {
    actionError.value = ''
    if (id) loadSubjectGrants(id)
    else subjectGrants.value = []
  },
  { immediate: true },
)

watch(
  () => props.subjects,
  () => {
    if (!selectedSubjectId.value || !filteredSubjects.value.some((subject) => subject.id === selectedSubjectId.value)) {
      selectedSubjectId.value = filteredSubjects.value[0]?.id ?? null
    }
  },
)

watch(filteredSubjects, (subjects) => {
  if (!subjects.some((subject) => subject.id === selectedSubjectId.value)) {
    selectedSubjectId.value = subjects[0]?.id ?? null
  }
})

// ---------------- Edit / create user ----------------

const editingSubject = ref(false)
const editTarget = ref<SubjectOut | null>(null)
const editForm = ref({ displayName: '', email: '' })
const editEmailError = ref('')
const editFormError = ref('')

const startEditSubject = () => {
  const subject = selectedSubject.value
  if (!subject) return
  editTarget.value = subject
  editForm.value = { displayName: subject.display_name ?? '', email: subject.email ?? '' }
  editEmailError.value = ''
  editFormError.value = ''
  editingSubject.value = true
}

const cancelEditSubject = () => {
  editingSubject.value = false
  editTarget.value = null
  editEmailError.value = ''
  editFormError.value = ''
}

const confirmEditSubject = async () => {
  const subject = editTarget.value
  if (!subject) return
  editEmailError.value = ''
  editFormError.value = ''
  try {
    await securityService.updateSubject(subject.id, {
      display_name: editForm.value.displayName.trim() || null,
      email: editForm.value.email.trim() || null,
    })
    cancelEditSubject()
    toast.success('Usuario actualizado correctamente.')
    emit('subjectsChanged')
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      editEmailError.value = 'El correo ya está en uso'
      return
    }
    editFormError.value = err instanceof Error ? err.message : 'No se pudo actualizar el usuario'
  }
}

// ---------------- Create / delete user ----------------

const creatingSubject = ref(false)
const newSubject = ref({
  username: '',
  displayName: '',
  email: '',
  roleId: '',
  orgUnitId: '',
  inheritDown: false,
})

const startCreateSubject = () => {
  creatingSubject.value = true
  actionError.value = ''
  newSubject.value = {
    username: '',
    displayName: '',
    email: '',
    roleId: props.roles[0]?.id ?? '',
    orgUnitId: props.orgUnits[0]?.id ?? '',
    inheritDown: false,
  }
}

const cancelCreateSubject = () => {
  creatingSubject.value = false
  actionError.value = ''
}

const confirmCreateSubject = async () => {
  const username = newSubject.value.username.trim()
  if (!username) {
    actionError.value = 'Ingresa un usuario.'
    return
  }
  try {
    const subject = await securityService.createSubject({
      username,
      display_name: newSubject.value.displayName.trim() || null,
      email: newSubject.value.email.trim() || null,
      active: true,
    })
    if (newSubject.value.roleId && newSubject.value.orgUnitId) {
      await securityService.createGrant({
        subject_id: subject.id,
        role_id: newSubject.value.roleId,
        org_unit_id: newSubject.value.orgUnitId,
        inherit_down: newSubject.value.inheritDown,
        effect: 'allow',
      })
      emit('grantsChanged')
    }
    selectedSubjectId.value = subject.id
    creatingSubject.value = false
    actionError.value = ''
    emit('subjectsChanged')
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : 'No se pudo crear el usuario'
  }
}

const handleToggleSubject = async () => {
  const subject = selectedSubject.value
  if (!subject || isOwnSubject.value) return
  const active = !subject.active
  const action = active ? 'Reactivar' : 'Desactivar'
  const ok = await confirm({
    title: `${action} el usuario "${subject.username}"?`,
    message: active
      ? 'El usuario recuperara el acceso y conservara sus roles.'
      : 'El usuario no podra iniciar sesion. Si tiene el portal abierto, su sesion se cerrara en la siguiente carga. Sus roles se conservaran.',
    ...(active
      ? {}
      : { warning: 'Los tokens ya emitidos seguirán funcionando hasta que venzan (máximo 60 minutos).' }),
    confirmLabel: `${action} usuario`,
    ...(active ? {} : { tone: 'danger' as const }),
  })
  if (!ok) return
  try {
    await securityService.updateSubject(subject.id, { active })
    actionError.value = ''
    toast.success(`Usuario ${active ? 'reactivado' : 'desactivado'} correctamente.`)
    emit('subjectsChanged')
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : `No se pudo ${action.toLowerCase()} el usuario`
  }
}

// ---------------- Assign / revoke ----------------

const assigningRole = ref(false)
const assignTarget = ref<SubjectOut | null>(null)
const fieldId = useId()
const assignForm = ref({
  roleId: '',
  orgUnitId: '',
  inheritDown: false,
  effect: 'allow' as 'allow' | 'deny',
})

const roleOptions = computed<SelectOption<string>[]>(() => props.roles.map((role) => ({ value: role.id, label: role.name })))
const optionalRoleOptions = computed<SelectOption<string>[]>(() => [
  { value: '', label: 'Sin rol inicial' },
  ...props.roles.map((role) => ({ value: role.id, label: role.name })),
])
const orgUnitOptions = computed<SelectOption<string>[]>(() =>
  props.orgUnits.map((unit) => ({ value: unit.id, label: unit.name, depth: orgUnitDepth(unit) })),
)
const effectOptions: SelectOption<'allow' | 'deny'>[] = [
  { value: 'allow', label: 'allow - concede el rol' },
  { value: 'deny', label: 'deny - lo bloquea explicitamente' },
]
const roleById = computed(() => new Map(props.roles.map((role) => [role.id, role])))
const permissionTooltipForRole = (roleId: string) => {
  const codes = roleById.value.get(roleId)?.permission_codes ?? []
  return codes.length ? codes.join('\n') : 'Este rol no tiene permisos asignados.'
}
const permissionCountForRole = (roleId: string) => roleById.value.get(roleId)?.permission_codes.length ?? 0
const newSubjectPermissionTooltip = computed(() => permissionTooltipForRole(newSubject.value.roleId))
const newSubjectPermissionCount = computed(() => permissionCountForRole(newSubject.value.roleId))
const assignPermissionTooltip = computed(() => permissionTooltipForRole(assignForm.value.roleId))
const assignPermissionCount = computed(() => permissionCountForRole(assignForm.value.roleId))

const startAssignRole = () => {
  assignTarget.value = selectedSubject.value
  assigningRole.value = true
  actionError.value = ''
  assignForm.value = {
    roleId: props.roles[0]?.id ?? '',
    orgUnitId: props.orgUnits[0]?.id ?? '',
    inheritDown: false,
    effect: 'allow',
  }
}

const cancelAssignRole = () => {
  assigningRole.value = false
  actionError.value = ''
}

const confirmAssignRole = async () => {
  const subject = assignTarget.value
  if (!subject) return
  if (!assignForm.value.roleId || !assignForm.value.orgUnitId) {
    actionError.value = 'Selecciona un rol y un ambito.'
    return
  }
  try {
    await securityService.createGrant({
      subject_id: subject.id,
      role_id: assignForm.value.roleId,
      org_unit_id: assignForm.value.orgUnitId,
      inherit_down: assignForm.value.inheritDown,
      effect: assignForm.value.effect,
    })
    assigningRole.value = false
    actionError.value = ''
    await loadSubjectGrants(subject.id)
    emit('grantsChanged')
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : 'No se pudo asignar el rol'
  }
}

const handleRevokeGrant = async (grantId: string) => {
  const subject = selectedSubject.value
  if (!subject) return
  const grant = subjectGrants.value.find((g) => g.id === grantId)
  const ok = await confirm({
    title: 'Revocar este otorgamiento?',
    message: grant
      ? `${subject.username} dejara de tener el rol "${grant.role_name}" en ${grant.org_unit_name}. El historial se conserva.`
      : 'El historial se conserva.',
    confirmLabel: 'Revocar',
    tone: 'danger',
  })
  if (!ok) return
  try {
    await securityService.revokeGrant(grantId)
    await loadSubjectGrants(subject.id)
    emit('grantsChanged')
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : 'No se pudo revocar el otorgamiento'
  }
}

const handleRevokeAllGrants = async () => {
  const subject = selectedSubject.value
  if (!subject || !subjectGrants.value.length) return
  const ok = await confirm({
    title: `Revocar todos los roles de ${subject.username}?`,
    message: `Se revocaran ${subjectGrants.value.length} otorgamientos activos. El historial se conserva.`,
    confirmLabel: 'Revocar todos',
    tone: 'danger',
  })
  if (!ok) return
  try {
    await Promise.all(subjectGrants.value.map((grant) => securityService.revokeGrant(grant.id)))
    await loadSubjectGrants(subject.id)
    emit('grantsChanged')
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : 'No se pudieron revocar todos los roles'
  }
}
</script>
