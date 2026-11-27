<template>
  <div>
    <p v-if="actionError && !modalOpen" class="login-card__error">{{ actionError }}</p>

    <section class="security-layout">
      <aside class="roles-panel">
        <label class="roles-search">
          <Search :size="15" aria-hidden="true" />
          <input
            v-model="search"
            type="search"
            placeholder="Buscar unidad..."
            aria-label="Buscar unidad por nombre o codigo"
            @keydown.enter.prevent="selectFirstMatch"
            @keydown.esc.stop="search = ''"
          />
        </label>

        <button
          v-if="canManage && root"
          class="role-create-button"
          type="button"
          aria-label="Nuevo país"
          title="Nuevo país"
          @click="startCreate(root)"
        >
          <Plus :size="17" aria-hidden="true" />
        </button>

        <p v-if="!filteredRows.length" class="roles-search__empty">Ninguna unidad coincide con "{{ search.trim() }}".</p>

        <div v-auto-animate class="roles-panel__list">
          <div
            v-for="row in pagedRows"
            :key="row.id"
            class="org-node"
            :style="{ '--depth': searching ? 0 : row.depth }"
          >
            <button
              v-if="!searching && childrenOf(row.id).length"
              class="org-node__toggle"
              :class="{ 'org-node__toggle--open': expanded.has(row.id) }"
              type="button"
              :aria-expanded="expanded.has(row.id)"
              :aria-label="`${expanded.has(row.id) ? 'Contraer' : 'Expandir'} ${row.unit.name}`"
              @click="toggle(row.id)"
            >
              <ChevronRight :size="15" aria-hidden="true" />
            </button>
            <span v-else class="org-node__toggle" aria-hidden="true"></span>

            <button
              class="role-row org-row"
              :class="{ 'role-row--active': row.id === selectedId }"
              type="button"
              @click="selectedId = row.id"
            >
              <span>
                <strong>{{ row.unit.name }}</strong>
                <small>{{ typeLabel(row.unit.type) }} · {{ row.unit.code }}</small>
              </span>
              <em>{{ childrenOf(row.id).length }}</em>
            </button>
          </div>
        </div>

        <nav v-if="pageCount > 1" class="pager" aria-label="Paginas de unidades">
          <button class="pager__btn" type="button" aria-label="Pagina anterior" :disabled="page === 1" @click="page--">
            <ChevronLeft :size="16" />
          </button>
          <span>{{ page }} / {{ pageCount }}</span>
          <button class="pager__btn" type="button" aria-label="Pagina siguiente" :disabled="page === pageCount" @click="page++">
            <ChevronRight :size="16" />
          </button>
        </nav>
      </aside>

      <div v-if="selected" class="security-main">
        <div class="security-card security-card--hero">
          <div>
            <h2>{{ selected.unit.name }}</h2>
            <p>{{ breadcrumb }}</p>
            <dl class="role-meta">
              <div>
                <dt>Tipo</dt>
                <dd>{{ typeLabel(selected.unit.type) }}</dd>
              </div>
              <div>
                <dt>Codigo</dt>
                <dd>{{ selected.unit.code }}</dd>
              </div>
              <div>
                <dt>Subunidades</dt>
                <dd>{{ selectedChildren.length }}</dd>
              </div>
            </dl>
          </div>
          <div v-if="canManage" class="security-card__actions">
            <button
              v-if="selected.depth < MAX_DEPTH"
              class="btn btn--primary icon-action"
              type="button"
              :aria-label="`Agregar ${childLabel(selected.depth)}`"
              :title="`Agregar ${childLabel(selected.depth)}`"
              @click="startCreate(selected)"
            >
              <Plus :size="16" aria-hidden="true" />
            </button>
            <button class="btn btn--soft icon-action" type="button" aria-label="Renombrar unidad" title="Renombrar unidad" @click="startRename(selected.unit)">
              <Pencil :size="16" aria-hidden="true" />
            </button>
            <button
              v-if="canDelete && selected.depth > 0"
              class="btn btn--danger-quiet icon-action"
              type="button"
              aria-label="Eliminar unidad"
              title="Eliminar unidad"
              @click="handleDelete(selected)"
            >
              <Trash2 :size="16" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div class="permissions-grid">
          <section class="security-card">
            <div class="security-card__title">
              <div>
                <h3>Subunidades</h3>
                <p v-if="selected.depth < MAX_DEPTH">Unidades directamente bajo esta. Abre una para ver su detalle.</p>
                <p v-else>Ultimo nivel: la estructura admite 5 niveles bajo Global.</p>
              </div>
              <span>{{ selectedChildren.length }}</span>
            </div>

            <ul v-if="selectedChildren.length" v-auto-animate class="module-summary-list">
              <li v-for="child in selectedChildren" :key="child.id">
                <button class="module-summary" type="button" @click="selectedId = child.id">
                  <span>
                    <strong>{{ child.name }}</strong>
                    <small>{{ typeLabel(child.type) }} · {{ child.code }}</small>
                  </span>
                  <span class="module-summary__action">
                    Abrir
                    <ChevronRight :size="14" />
                  </span>
                </button>
              </li>
            </ul>
            <p v-else class="security-card__empty">Esta unidad no tiene subunidades.</p>
          </section>

          <section class="security-card">
            <div class="security-card__title">
              <div>
                <h3>Otorgamientos Activos</h3>
                <p>Roles asignados con esta unidad como ambito.</p>
              </div>
              <span>{{ unitGrants.length }}</span>
            </div>
            <p v-if="grantsLoading">Cargando otorgamientos...</p>
            <ul v-else-if="unitGrants.length" v-auto-animate class="grants-list">
              <li v-for="grant in unitGrants" :key="grant.id">
                <div>
                  <strong>{{ grant.subject_username }}</strong>
                  <small>{{ grant.role_name }}<span v-if="grant.inherit_down"> (+ descendientes)</span></small>
                </div>
                <em :class="`effect-pill effect-pill--${grant.effect}`">{{ grant.effect }}</em>
              </li>
            </ul>
            <p v-else class="security-card__empty">Ningun rol esta asignado sobre esta unidad.</p>
          </section>
        </div>
      </div>
    </section>

    <BaseModal
      :open="modalOpen"
      :title="mode === 'create' ? `Nueva unidad: ${newChildLabel}` : 'Renombrar unidad'"
      :description="mode === 'create' ? `Dentro de ${target?.name ?? ''}.` : undefined"
      @close="closeModal"
      @submit="submit"
    >
      <label>
        <span>Nombre</span>
        <input v-model="form.name" type="text" required minlength="2" maxlength="150" data-autofocus />
      </label>

      <template v-if="mode === 'create'">
        <label>
          <span>Codigo <small>(letras, numeros y _ ; no se puede cambiar despues)</small></span>
          <input
            v-model="form.code"
            type="text"
            required
            maxlength="63"
            pattern="[a-zA-Z0-9_]+"
            title="Solo letras, numeros y guion bajo"
            placeholder="p. ej. sv_suc_centro"
          />
        </label>

        <label v-if="freeLevel">
          <span>Tipo de nivel</span>
          <input v-model="form.type" type="text" required minlength="2" maxlength="50" placeholder="p. ej. Departamento" />
        </label>
      </template>

      <p v-if="actionError" class="login-card__error">{{ actionError }}</p>

      <template #actions>
        <button class="btn" type="button" @click="closeModal">Cancelar</button>
        <button class="btn btn--primary" type="submit">{{ mode === 'create' ? 'Crear' : 'Guardar' }}</button>
      </template>
    </BaseModal>
  </div>
</template>

<script setup lang="ts">
import { computed, onActivated, onMounted, reactive, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2 } from 'lucide-vue-next'
import { securityService, type GrantOut, type OrgUnitOut } from '@/services/securityService'
import { useSession } from '@/composables/useSession'
import { useConfirm } from '@/composables/useConfirm'
import { usePagination } from '@/composables/usePagination'
import { PERMISSIONS } from '@/config/permissions'
import BaseModal from '@/components/ui/BaseModal.vue'

const props = defineProps<{ orgUnits: OrgUnitOut[] }>()
const emit = defineEmits<{ changed: [] }>()

// UI gating only: the API re-checks the permission and the caller's subtree,
// so a country administrator gets a 403 outside their country.
const { can } = useSession()
const canManage = computed(() => can(PERMISSIONS.IAM_ORG_UNIT_MANAGE))
const canDelete = computed(() => can(PERMISSIONS.IAM_ORG_UNIT_DELETE))
const confirm = useConfirm()

const actionError = ref('')

// Global is depth 0; the API allows five levels below it (iam-api org_units.py).
const MAX_DEPTH = 5
const FIXED_LABELS: Record<string, string> = {
  global: 'Global',
  country: 'País',
  organization: 'Organización',
  branch: 'Sucursal',
}
const FIXED_CHILD = ['país', 'organización', 'sucursal']
const typeLabel = (type: string) => FIXED_LABELS[type] ?? type
const childLabel = (depth: number) => FIXED_CHILD[depth] ?? 'subunidad'

// ---------------- Tree ----------------

interface Row {
  id: string
  unit: OrgUnitOut
  depth: number
}

const byParent = computed(() => {
  const map = new Map<string | null, OrgUnitOut[]>()
  for (const unit of props.orgUnits) {
    map.set(unit.parent_id, [...(map.get(unit.parent_id) ?? []), unit])
  }
  for (const siblings of map.values()) siblings.sort((a, b) => a.name.localeCompare(b.name))
  return map
})
const childrenOf = (id: string | null) => byParent.value.get(id) ?? []

// Walk from the root by parent_id, not by sorting paths: string order puts
// `a_b` between `a` and `a.b`, which would draw a sibling as a child.
const walkTree = (descend: (id: string) => boolean) => {
  const out: Row[] = []
  const walk = (parentId: string | null, depth: number) => {
    for (const unit of childrenOf(parentId)) {
      out.push({ id: unit.id, unit, depth })
      if (descend(unit.id)) walk(unit.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
}

// Every unit, for search and selection; the list shows only expanded branches.
const rows = computed(() => walkTree(() => true))
const root = computed(() => rows.value[0] ?? null)

// Only the root starts open: countries are visible, everything below is one click away.
const expanded = ref(new Set<string>(root.value ? [root.value.id] : []))
const visibleRows = computed(() => walkTree((id) => expanded.value.has(id)))

const toggle = (id: string) => {
  if (expanded.value.has(id)) expanded.value.delete(id)
  else expanded.value.add(id)
}

// ---------------- Search ----------------

// Same as RolesTab: client-side, case- and accent-insensitive.
const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

const search = ref('')
const searching = computed(() => search.value.trim() !== '')
// A search looks through collapsed branches too, and lists matches flat.
const filteredRows = computed(() => {
  const query = normalize(search.value.trim())
  if (!query) return visibleRows.value
  return rows.value.filter((row) => normalize(`${row.unit.name} ${row.unit.code}`).includes(query))
})

const selectFirstMatch = () => {
  const first = filteredRows.value[0]
  if (first) selectedId.value = first.id
}

// ---------------- Selection & pagination ----------------

const selectedId = ref<string | null>(root.value?.id ?? null)
const selected = computed(() => rows.value.find((row) => row.id === selectedId.value) ?? null)
const selectedChildren = computed(() => (selected.value ? childrenOf(selected.value.id) : []))

// Names from the root down: "Global › El Salvador › org1".
const breadcrumb = computed(() => {
  const names: string[] = []
  let unit = selected.value?.unit
  while (unit) {
    names.unshift(unit.name)
    const parentId = unit.parent_id
    unit = props.orgUnits.find((u) => u.id === parentId)
  }
  return names.join(' › ')
})

const UNITS_PER_PAGE = 8
const { page, pageCount, pagedItems: pagedRows } = usePagination(filteredRows, selectedId, UNITS_PER_PAGE)

// A unit deleted elsewhere (or the first load arriving late) leaves nothing selected.
watch(rows, () => {
  if (!selected.value) selectedId.value = root.value?.id ?? null
})

// Whatever selects a unit (search, the Subunidades card, a create) opens
// its ancestors, so the selection is visible once the search is cleared.
watch(
  [selectedId, () => props.orgUnits],
  () => {
    actionError.value = ''
    let parentId = props.orgUnits.find((u) => u.id === selectedId.value)?.parent_id
    while (parentId) {
      expanded.value.add(parentId)
      const id: string = parentId
      parentId = props.orgUnits.find((u) => u.id === id)?.parent_id
    }
  },
)

// ---------------- Grants on the selected unit ----------------

// One fetch for every active grant, filtered here: the list is small and the
// API has no per-unit filter.
const grants = ref<GrantOut[]>([])
const grantsLoading = ref(false)
const unitGrants = computed(() => grants.value.filter((g) => g.org_unit_id === selectedId.value))

const loadGrants = async () => {
  grantsLoading.value = true
  try {
    grants.value = await securityService.listGrants()
  } catch (err) {
    grants.value = []
    actionError.value = err instanceof Error ? err.message : 'No se pudieron cargar los otorgamientos'
  } finally {
    grantsLoading.value = false
  }
}

onMounted(loadGrants)
// Grants are assigned from the Users tab; KeepAlive would otherwise show a stale list.
onActivated(loadGrants)

// ---------------- Create / rename ----------------

const modalOpen = ref(false)
const mode = ref<'create' | 'rename'>('create')
const target = ref<OrgUnitOut | null>(null)
const targetDepth = ref(0)
const form = reactive({ name: '', code: '', type: '' })

const freeLevel = computed(() => targetDepth.value + 1 > FIXED_CHILD.length)
const newChildLabel = computed(() => FIXED_CHILD[targetDepth.value] ?? 'nivel libre')

const startCreate = (row: Row) => {
  mode.value = 'create'
  target.value = row.unit
  targetDepth.value = row.depth
  // Prefill a free level with what its siblings are called, if any.
  Object.assign(form, { name: '', code: '', type: childrenOf(row.id)[0]?.type ?? '' })
  actionError.value = ''
  modalOpen.value = true
}

const startRename = (unit: OrgUnitOut) => {
  mode.value = 'rename'
  target.value = unit
  Object.assign(form, { name: unit.name, code: unit.code, type: unit.type })
  actionError.value = ''
  modalOpen.value = true
}

const closeModal = () => {
  modalOpen.value = false
  actionError.value = ''
}

const submit = async () => {
  const unit = target.value
  if (!unit) return
  try {
    if (mode.value === 'create') {
      const created = await securityService.createOrgUnit({
        parent_id: unit.id,
        code: form.code.trim(),
        name: form.name.trim(),
        type: freeLevel.value ? form.type.trim() : null,
      })
      search.value = '' // or a search that doesn't match would hide the new unit
      selectedId.value = created.id
    } else {
      await securityService.renameOrgUnit(unit.id, form.name.trim())
    }
    modalOpen.value = false
    actionError.value = ''
    emit('changed')
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : 'No se pudo guardar la unidad'
  }
}

// ---------------- Delete ----------------

const handleDelete = async (row: Row) => {
  // Captured up front: the selection could change while the dialog is open.
  const unit = row.unit
  const ok = await confirm({
    title: `¿Eliminar "${unit.name}"?`,
    message: 'Solo se puede eliminar una unidad sin subunidades ni otorgamientos.',
    confirmLabel: 'Eliminar unidad',
    tone: 'danger',
  })
  if (!ok) return

  try {
    await securityService.deleteOrgUnit(unit.id)
    selectedId.value = unit.parent_id
    actionError.value = ''
    emit('changed')
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : 'No se pudo eliminar la unidad'
  }
}
</script>
