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
      <ul class="toggle-list module-permission-group modal-card__scroll">
        <li v-for="permission in module.permissions" :key="permission.id">
          <span>
            {{ permission.code }}
            <em v-if="permission.sensitive" class="sensitive-badge" title="Requiere privilegios elevados (FR-14)">sensible</em>
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
import BaseModal from '@/components/ui/BaseModal.vue'
import { securityService, type ModuleWithPermissions, type RoleOut } from '@/services/securityService'

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

// Start from the role's current state every time the modal opens.
watch(
  () => props.open,
  (open) => {
    if (!open || !props.role) return
    original.value = new Set(props.role.permission_codes.filter((code) => moduleCodes.value.has(code)))
    draft.value = new Set(original.value)
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
