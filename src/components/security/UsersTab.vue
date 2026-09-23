<template>
  <div>
    <p v-if="actionError && !assigningRole" class="login-card__error">{{ actionError }}</p>

    <section class="security-layout">
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

    <BaseModal
      :open="assigningRole"
      :title="`Asignar Rol a ${assignTarget?.username ?? ''}`"
      description="Crea un nuevo otorgamiento (GRANT) para este sujeto."
      @close="cancelAssignRole"
      @submit="confirmAssignRole"
    >
      <!-- divs, not labels: a label forwards clicks inside it to its control,
           which would re-toggle the dropdown when an option is clicked. -->
      <div class="modal-field">
        <span :id="`${fieldId}-role`">Rol</span>
        <BaseSelect v-model="assignForm.roleId" :options="roleOptions" :aria-labelledby="`${fieldId}-role`" data-autofocus />
      </div>

      <div class="modal-field">
        <span :id="`${fieldId}-unit`">Ambito (unidad organizacional)</span>
        <BaseSelect v-model="assignForm.orgUnitId" :options="orgUnitOptions" :aria-labelledby="`${fieldId}-unit`" />
      </div>

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

// Assigning or revoking moves the grant counts shown on both tabs; the parent
// owns those lists, so it does the refetch.
const emit = defineEmits<{ grantsChanged: [] }>()

// UI gating only — every one of these endpoints re-checks the permission
// server-side, so hiding a button is a courtesy, never the control.
const { can } = useSession()
const canCreateGrants = computed(() => can('iam.grant.create'))
const canRevokeGrants = computed(() => can('iam.grant.revoke'))

const actionError = ref('')
const confirm = useConfirm()

const orgUnitDepth = (unit: OrgUnitOut) => (unit.path ? unit.path.split('.').length - 1 : 0)

// ---------------- Selected user ----------------

const selectedSubjectId = ref<string | null>(props.subjects[0]?.id ?? null)
const selectedSubject = computed(() => props.subjects.find((s) => s.id === selectedSubjectId.value) ?? null)

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
  },
  { immediate: true },
)

// ---------------- Assign / revoke ----------------

const assigningRole = ref(false)
// Kept apart from the selection so the title doesn't change mid-animation.
const assignTarget = ref<SubjectOut | null>(null)
const fieldId = useId()
const assignForm = ref({
  roleId: '',
  orgUnitId: '',
  inheritDown: false,
  effect: 'allow' as 'allow' | 'deny',
})

const roleOptions = computed<SelectOption<string>[]>(() => props.roles.map((role) => ({ value: role.id, label: role.name })))
const orgUnitOptions = computed<SelectOption<string>[]>(() =>
  props.orgUnits.map((unit) => ({ value: unit.id, label: unit.name, depth: orgUnitDepth(unit) })),
)
const effectOptions: SelectOption<'allow' | 'deny'>[] = [
  { value: 'allow', label: 'allow — concede el rol' },
  { value: 'deny', label: 'deny — lo bloquea explicitamente' },
]

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
  // Captured up front: the selection could change while the dialog is open.
  const subject = selectedSubject.value
  if (!subject) return
  const grant = subjectGrants.value.find((g) => g.id === grantId)
  const ok = await confirm({
    title: '¿Revocar este otorgamiento?',
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
</script>
