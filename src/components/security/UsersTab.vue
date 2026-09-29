<template>
  <div>
    <p v-if="actionError && !assigningRole && !creatingSubject" class="login-card__error">{{ actionError }}</p>

    <section class="security-layout">
      <aside v-auto-animate class="roles-panel">
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

        <button
          v-for="subject in filteredSubjects"
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
            <button
              v-if="canDeleteSubjects"
              class="btn btn--danger-quiet icon-action"
              type="button"
              aria-label="Eliminar usuario"
              title="Eliminar usuario"
              @click="handleDeleteSubject"
            >
              <Trash2 :size="16" aria-hidden="true" />
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
import { RotateCcw, Search, ShieldPlus, Trash2, UserPlus, X } from 'lucide-vue-next'
import { securityService, type GrantOut, type OrgUnitOut, type RoleOut, type SubjectOut } from '@/services/securityService'
import { useSession } from '@/composables/useSession'
import { useConfirm } from '@/composables/useConfirm'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSelect, { type SelectOption } from '@/components/ui/BaseSelect.vue'

const props = defineProps<{
  subjects: SubjectOut[]
  roles: RoleOut[]
  orgUnits: OrgUnitOut[]
}>()

const emit = defineEmits<{ grantsChanged: []; subjectsChanged: [] }>()

const { can } = useSession()
const canCreateGrants = computed(() => can('iam.grant.create'))
const canRevokeGrants = computed(() => can('iam.grant.revoke'))
const canCreateSubjects = computed(
  () => can('iam.subject.manage') || can('iam.subject.create') || can('iam.user.manage') || canCreateGrants.value,
)
const canDeleteSubjects = computed(() => can('iam.subject.manage') || can('iam.subject.delete') || can('iam.user.manage'))

const actionError = ref('')
const confirm = useConfirm()

const orgUnitDepth = (unit: OrgUnitOut) => (unit.path ? unit.path.split('.').length - 1 : 0)
const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

// ---------------- Selected user ----------------

const subjectSearch = ref('')
const selectedSubjectId = ref<string | null>(props.subjects[0]?.id ?? null)
const selectedSubject = computed(() => props.subjects.find((s) => s.id === selectedSubjectId.value) ?? null)
const filteredSubjects = computed(() => {
  const query = normalize(subjectSearch.value.trim())
  if (!query) return props.subjects
  return props.subjects.filter((subject) =>
    normalize(`${subject.username} ${subject.display_name ?? ''} ${subject.email ?? ''}`).includes(query),
  )
})

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
  (subjects) => {
    if (!selectedSubjectId.value || !subjects.some((subject) => subject.id === selectedSubjectId.value)) {
      selectedSubjectId.value = subjects[0]?.id ?? null
    }
  },
)

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

const handleDeleteSubject = async () => {
  const subject = selectedSubject.value
  if (!subject) return
  const ok = await confirm({
    title: `Eliminar el usuario "${subject.username}"?`,
    message: 'Si tiene roles activos, revocalos antes. Esta accion depende de que el servidor permita eliminar sujetos.',
    confirmLabel: 'Eliminar usuario',
    tone: 'danger',
  })
  if (!ok) return
  try {
    await securityService.deleteSubject(subject.id)
    selectedSubjectId.value = props.subjects.find((s) => s.id !== subject.id)?.id ?? null
    actionError.value = ''
    emit('subjectsChanged')
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : 'No se pudo eliminar el usuario'
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
