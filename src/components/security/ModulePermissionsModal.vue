<template>
  <BaseModal
    :open="open"
    :title="module?.name ?? ''"
    :description="description"
    size="wide"
    @close="emit('close')"
    @submit="save"
  >
    <template v-if="module">
      <div class="permission-editor-panel">
        <div class="permission-editor-summary">
          <div>
            <span>Seleccionados</span>
            <strong>{{ draft.size }}</strong>
          </div>
          <div>
            <span>Disponibles</span>
            <strong>{{ module.permissions.length }}</strong>
          </div>
        </div>

        <div class="permission-editor-tools">
          <label class="permission-search">
            <Search :size="15" aria-hidden="true" />
            <input v-model="permissionSearch" type="search" placeholder="Buscar permiso..." aria-label="Buscar permiso" />
            <button v-if="permissionSearch" type="button" aria-label="Limpiar busqueda" title="Limpiar busqueda" @click="permissionSearch = ''">
              <X :size="14" aria-hidden="true" />
            </button>
          </label>

          <div v-if="canManage && module.permissions.length" class="permission-bulk-actions">
            <button class="btn btn--soft icon-action" type="button" aria-label="Asignar todos los permisos" title="Asignar todos" @click="selectAll">
              <CheckCheck :size="16" aria-hidden="true" />
            </button>
            <button class="btn btn--soft icon-action" type="button" aria-label="Quitar todos los permisos" title="Quitar todos" @click="clearAll">
              <Eraser :size="16" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <div v-if="filteredPermissions.length" class="modal-card__scroll permission-scroll">
        <section v-for="group in groupedPermissions" :key="group.resource" class="permission-resource-group">
          <header>
            <h3>{{ group.resource }}</h3>
            <span>{{ selectedInGroup(group.permissions) }} / {{ group.permissions.length }}</span>
          </header>

          <ul class="toggle-list module-permission-group">
            <li v-for="permission in group.permissions" :key="permission.id">
              <span class="permission-row__meta">
                <strong>{{ permission.action }}</strong>
                <small>{{ permission.description || permission.code }}</small>
                <em v-if="permission.sensitive" class="sensitive-badge" title="Requiere privilegios elevados">sensible</em>
              </span>
              <button
                class="switch"
                :class="{ 'switch--on': draft.has(permission.code) }"
                type="button"
                :disabled="!canManage"
                :aria-label="`Activar ${permission.code}`"
                :aria-pressed="draft.has(permission.code)"
                @click="toggle(permission.code)"
              ></button>
            </li>
          </ul>
        </section>
      </div>
      <p v-if="module.permissions.length && !filteredPermissions.length" class="security-card__empty">Ningun permiso coincide con la busqueda.</p>
      <p v-if="!module.permissions.length" class="security-card__empty">Este modulo no tiene permisos registrados.</p>
    </template>

    <p v-if="error" class="login-card__error">{{ error }}</p>

    <template #actions>
      <button class="btn" type="button" @click="emit('close')">{{ canManage ? 'Cancelar' : 'Cerrar' }}</button>
      <button v-if="canManage" class="btn btn--primary" type="submit" :disabled="!isDirty || saving">
        {{ saving ? 'Guardando...' : 'Guardar' }}
      </button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CheckCheck, Eraser, Search, X } from 'lucide-vue-next'
import BaseModal from '@/components/ui/BaseModal.vue'
import { securityService, type ModuleWithPermissions, type PermissionOut, type RoleOut } from '@/services/securityService'

// `role` and `module` stay set after closing, so the content doesn't vanish
// while the modal animates out; `open` alone drives visibility.
const props = defineProps<{
  open: boolean
  role: RoleOut | null
  module: ModuleWithPermissions | null
  canManage: boolean
}>()

const emit = defineEmits<{
  close: []
  saved: [role: RoleOut]
}>()

const description = computed(() => (props.role ? `Permisos de este modulo que trae el rol "${props.role.name}".` : ''))
const moduleCodes = computed(() => new Set(props.module?.permissions.map((p) => p.code) ?? []))
const original = ref<Set<string>>(new Set())
const draft = ref<Set<string>>(new Set())
const saving = ref(false)
const error = ref('')
const permissionSearch = ref('')

// Start from the role's current state every time the modal opens.
watch(
  () => props.open,
  (open) => {
    if (!open || !props.role) return
    original.value = new Set(props.role.permission_codes.filter((code) => moduleCodes.value.has(code)))
    draft.value = new Set(original.value)
    permissionSearch.value = ''
    error.value = ''
  },
  { immediate: true },
)

const isDirty = computed(
  () => draft.value.size !== original.value.size || [...draft.value].some((code) => !original.value.has(code)),
)

const toggle = (code: string) => {
  const next = new Set(draft.value)
  if (next.has(code)) next.delete(code)
  else next.add(code)
  draft.value = next
}

const selectAll = () => {
  draft.value = new Set(moduleCodes.value)
}

const clearAll = () => {
  draft.value = new Set()
}

const normalizedPermissionSearch = computed(() =>
  permissionSearch.value
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase(),
)

const filteredPermissions = computed(() => {
  const permissions = props.module?.permissions ?? []
  const query = normalizedPermissionSearch.value
  if (!query) return permissions
  return permissions.filter((permission) => {
    const haystack = `${permission.code} ${permission.resource} ${permission.action} ${permission.description ?? ''}`
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
    return haystack.includes(query)
  })
})

const groupedPermissions = computed(() => {
  const groups = new Map<string, PermissionOut[]>()
  for (const permission of filteredPermissions.value) {
    const permissions = groups.get(permission.resource) ?? []
    permissions.push(permission)
    groups.set(permission.resource, permissions)
  }
  return [...groups.entries()].map(([resource, permissions]) => ({ resource, permissions }))
})

const selectedInGroup = (permissions: PermissionOut[]) => permissions.filter((permission) => draft.value.has(permission.code)).length

// The endpoint replaces the role's whole permission set, so keep every code
// from other modules as-is and swap in only this module's draft.
const save = async () => {
  if (!props.role || !props.canManage || !isDirty.value) return
  const next = [...props.role.permission_codes.filter((code) => !moduleCodes.value.has(code)), ...draft.value]
  saving.value = true
  error.value = ''
  try {
    emit('saved', await securityService.replaceRolePermissions(props.role.id, next))
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'No se pudieron guardar los cambios'
  } finally {
    saving.value = false
  }
}
</script>
