<template>
  <Teleport to="body">
    <div class="modal-backdrop" @click.self="emit('close')">
      <form class="modal-card modal-card--wide" @submit.prevent="save">
        <h2>{{ module.name }}</h2>
        <p>Permisos de este modulo que trae el rol "{{ role.name }}".</p>

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

        <p v-if="error" class="login-card__error">{{ error }}</p>

        <div class="modal-card__actions">
          <button class="btn" type="button" @click="emit('close')">{{ canManage ? 'Cancelar' : 'Cerrar' }}</button>
          <button v-if="canManage" class="btn btn--primary" type="submit" :disabled="!isDirty || saving">
            {{ saving ? 'Guardando...' : 'Guardar' }}
          </button>
        </div>
      </form>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { securityService, type ModuleWithPermissions, type RoleOut } from '@/services/securityService'
import { useEscapeKey } from '@/composables/useEscapeKey'

const props = defineProps<{
  role: RoleOut
  module: ModuleWithPermissions
  canManage: boolean
}>()

const emit = defineEmits<{
  close: []
  saved: [role: RoleOut]
}>()

useEscapeKey(() => emit('close'))

const moduleCodes = new Set(props.module.permissions.map((p) => p.code))
const original = new Set(props.role.permission_codes.filter((code) => moduleCodes.has(code)))

const draft = ref<Set<string>>(new Set(original))
const saving = ref(false)
const error = ref('')

const isDirty = computed(() => draft.value.size !== original.size || [...draft.value].some((code) => !original.has(code)))

const toggle = (code: string) => {
  const next = new Set(draft.value)
  if (next.has(code)) next.delete(code)
  else next.add(code)
  draft.value = next
}

// The endpoint replaces the role's whole permission set, so keep every code
// from other modules as-is and swap in only this module's draft.
const save = async () => {
  const next = [...props.role.permission_codes.filter((code) => !moduleCodes.has(code)), ...draft.value]
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
