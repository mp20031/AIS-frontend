import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import RolesTab from '@/components/security/RolesTab.vue'
import ModulePermissionsModal from '@/components/security/ModulePermissionsModal.vue'
import { confirmState, settleConfirm } from '@/composables/useConfirm'
import { useSession } from '@/composables/useSession'
import type { ModuleWithPermissions, PermissionOut, RoleOut } from '@/services/securityService'
import { callsTo, json, mockFetch } from '@/services/__tests__/fetchMock'
import { grant, role, signInAs } from './securityFixtures'

const permission = (code: string, overrides: Partial<PermissionOut> = {}): PermissionOut => {
  const [moduleKey, resource, action] = code.split('.')
  return {
    id: `perm-${code}`,
    module_id: `mod-${moduleKey}`,
    module_key: moduleKey,
    code,
    resource,
    action,
    sensitive: false,
    description: null,
    ...overrides,
  }
}

const ACCOUNTING: ModuleWithPermissions = {
  id: 'mod-accounting',
  key: 'accounting',
  name: 'Contabilidad',
  description: null,
  active: true,
  permissions: [
    permission('accounting.invoice.view', { description: 'Ver facturas' }),
    permission('accounting.invoice.approve', { sensitive: true }),
    permission('accounting.ledger.close'),
  ],
}

const HR: ModuleWithPermissions = {
  id: 'mod-hr',
  key: 'hr',
  name: 'Recursos Humanos',
  description: null,
  active: true,
  permissions: [permission('hr.employee.view')],
}

const CONTADOR = role('Contador', ['accounting.invoice.view', 'hr.employee.view'], {
  description: 'Lleva la contabilidad',
  active_grant_count: 1,
})
const AUDITORIA = role('Auditoría', [], { description: 'Solo consulta' })

async function mountRoles(routes: Parameters<typeof mockFetch>[0] = {}, roles: RoleOut[] = [CONTADOR, AUDITORIA]) {
  const fetchMock = mockFetch({ '/v1/grants': () => json(200, []), ...routes })
  const wrapper = mount(RolesTab, {
    props: {
      modules: [ACCOUNTING, HR],
      roles,
      'onUpdate:roles': (next: RoleOut[]) => wrapper.setProps({ roles: next }),
    },
    global: { directives: { autoAnimate: {} }, stubs: { teleport: true } },
  })
  await flushPromises()
  const rows = () => wrapper.findAll('.role-row strong').map((s) => s.text())
  return { wrapper, fetchMock, rows }
}

describe('RolesTab', () => {
  beforeEach(async () => {
    localStorage.clear()
    sessionStorage.clear()
    useSession().clear()
    await signInAs(['iam.role.manage'])
  })

  it('selects the first role and shows its summary and grants', async () => {
    const { wrapper, fetchMock } = await mountRoles({
      '/v1/grants': () => json(200, [grant('g1', 'Contador', { subject_username: 'user-88' })]),
    })

    expect(wrapper.get('.security-card--hero h2').text()).toBe('Contador')
    expect(callsTo(fetchMock, '/v1/grants')[0][0]).toContain('role_id=role-Contador')
    expect(wrapper.get('.grants-list').text()).toContain('user-88')

    const summaries = wrapper.findAll('.module-summary').map((s) => s.text())
    expect(summaries[0]).toContain('1 de 3 permisos')
    expect(summaries[1]).toContain('1 de 1 permisos')
  })

  it('searches by name or description, ignoring accents; Enter selects the match', async () => {
    const { wrapper, rows } = await mountRoles()
    const search = wrapper.get('input[type="search"]')

    await search.setValue('auditoria')
    expect(rows()).toEqual(['Auditoría'])
    await search.trigger('keydown', { key: 'Enter' })
    expect(wrapper.get('.security-card--hero h2').text()).toBe('Auditoría')

    await search.setValue('contabilidad')
    expect(rows()).toEqual(['Contador'])

    await search.setValue('zzz')
    expect(wrapper.text()).toContain('Ningun rol coincide con "zzz".')
  })

  it('a view-only user sees "Ver" and no create or delete buttons', async () => {
    await signInAs(['iam.user.view'])
    const { wrapper } = await mountRoles()

    expect(wrapper.find('[aria-label="Nuevo rol"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="Eliminar rol"]').exists()).toBe(false)
    expect(wrapper.get('.module-summary').text()).toContain('Ver')
  })

  it('creating a role requires a name', async () => {
    const { wrapper, fetchMock } = await mountRoles()
    await wrapper.get('[aria-label="Nuevo rol"]').trigger('click')
    await wrapper.get('[role="dialog"] form, form[role="dialog"]').trigger('submit')

    expect(wrapper.text()).toContain('Ingresa un nombre para el nuevo rol.')
    expect(callsTo(fetchMock, '/v1/roles')).toHaveLength(0)
  })

  it('creating a role adds it and selects it, even under a search that hid it', async () => {
    const created = role('Bodeguero', [], { description: null })
    const { wrapper, fetchMock, rows } = await mountRoles({ '/v1/roles': () => json(201, created) })
    await wrapper.get('input[type="search"]').setValue('conta')

    await wrapper.get('[aria-label="Nuevo rol"]').trigger('click')
    const form = wrapper.get('form[role="dialog"]')
    await form.get('input[type="text"]').setValue('  Bodeguero ')
    await form.trigger('submit')
    await flushPromises()

    expect(JSON.parse(String(callsTo(fetchMock, '/v1/roles')[0][1]?.body))).toEqual({
      name: 'Bodeguero',
      description: null,
    })
    expect(rows()).toEqual(['Contador', 'Auditoría', 'Bodeguero'])
    expect(wrapper.get('.security-card--hero h2').text()).toBe('Bodeguero')
  })

  it('deleting a role asks first, removes it and selects the next', async () => {
    const { wrapper, fetchMock, rows } = await mountRoles({ '/v1/roles/role-Contador': () => json(204) })

    await wrapper.get('[aria-label="Eliminar rol"]').trigger('click')
    await vi.waitFor(() => expect(confirmState.open).toBe(true))
    expect(confirmState.options.title).toBe('¿Eliminar el rol "Contador"?')
    settleConfirm(true)
    await flushPromises()

    expect(callsTo(fetchMock, '/v1/roles/role-Contador')[0][1]?.method).toBe('DELETE')
    expect(rows()).toEqual(['Auditoría'])
    expect(wrapper.get('.security-card--hero h2').text()).toBe('Auditoría')
  })

  it('a failed delete keeps the role and shows why', async () => {
    const { wrapper, rows } = await mountRoles({
      '/v1/roles/role-Contador': () => json(409, { detail: 'El rol tiene otorgamientos activos' }),
    })
    await wrapper.get('[aria-label="Eliminar rol"]').trigger('click')
    await vi.waitFor(() => expect(confirmState.open).toBe(true))
    settleConfirm(true)
    await flushPromises()

    expect(rows()).toContain('Contador')
    expect(wrapper.text()).toContain('El rol tiene otorgamientos activos')
  })

  it('saving a module updates the role in the list and confirms', async () => {
    const updated = { ...CONTADOR, permission_codes: [...CONTADOR.permission_codes, 'accounting.ledger.close'] }
    const { wrapper } = await mountRoles()

    await wrapper.findAll('.module-summary')[0].trigger('click')
    wrapper.findComponent(ModulePermissionsModal).vm.$emit('saved', updated)
    await flushPromises()

    expect(wrapper.text()).toContain('Cambios guardados para "Contador".')
    expect(wrapper.findAll('.module-summary')[0].text()).toContain('2 de 3 permisos')
  })
})

describe('ModulePermissionsModal', () => {
  const mountModal = (props: Partial<InstanceType<typeof ModulePermissionsModal>['$props']> = {}) =>
    mount(ModulePermissionsModal, {
      props: { open: true, role: CONTADOR, module: ACCOUNTING, canManage: true, ...props },
      global: { stubs: { teleport: true } },
    })
  const switchFor = (wrapper: ReturnType<typeof mountModal>, code: string) => wrapper.get(`[aria-label="Activar ${code}"]`)
  const saveButton = (wrapper: ReturnType<typeof mountModal>) => wrapper.get('button[type="submit"]')

  it("starts from the role's permissions in this module, grouped by resource", () => {
    const wrapper = mountModal()

    expect(switchFor(wrapper, 'accounting.invoice.view').attributes('aria-pressed')).toBe('true')
    expect(switchFor(wrapper, 'accounting.invoice.approve').attributes('aria-pressed')).toBe('false')
    expect(wrapper.findAll('.permission-resource-group h3').map((h) => h.text())).toEqual(['invoice', 'ledger'])
    expect(wrapper.text()).toContain('sensible')
    expect(saveButton(wrapper).attributes('disabled')).toBeDefined()
  })

  it('saves this module\'s choice and keeps the codes of other modules', async () => {
    const fetchMock = mockFetch({ '/v1/roles/role-Contador/permissions': () => json(200, CONTADOR) })
    const wrapper = mountModal()

    await switchFor(wrapper, 'accounting.invoice.view').trigger('click')
    await switchFor(wrapper, 'accounting.ledger.close').trigger('click')
    expect(saveButton(wrapper).attributes('disabled')).toBeUndefined()
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
    expect(body.permission_codes.sort()).toEqual(['accounting.ledger.close', 'hr.employee.view'])
    expect(wrapper.emitted('saved')?.[0]).toEqual([CONTADOR])
  })

  it('toggling back to the original is not a change', async () => {
    const wrapper = mountModal()
    await switchFor(wrapper, 'accounting.ledger.close').trigger('click')
    await switchFor(wrapper, 'accounting.ledger.close').trigger('click')
    expect(saveButton(wrapper).attributes('disabled')).toBeDefined()
  })

  it('select all and clear all', async () => {
    const wrapper = mountModal()
    const pressed = () => wrapper.findAll('.switch').filter((s) => s.attributes('aria-pressed') === 'true').length

    await wrapper.get('[aria-label="Asignar todos los permisos"]').trigger('click')
    expect(pressed()).toBe(3)
    await wrapper.get('[aria-label="Quitar todos los permisos"]').trigger('click')
    expect(pressed()).toBe(0)
  })

  it('search filters by code, action or description', async () => {
    const wrapper = mountModal()
    await wrapper.get('input[type="search"]').setValue('facturas')
    expect(wrapper.findAll('.switch')).toHaveLength(1)

    await wrapper.get('input[type="search"]').setValue('nada')
    expect(wrapper.text()).toContain('Ningun permiso coincide con la busqueda.')
  })

  it('read-only for a user who cannot manage roles', () => {
    const wrapper = mountModal({ canManage: false })
    expect(switchFor(wrapper, 'accounting.invoice.view').attributes('disabled')).toBeDefined()
    expect(wrapper.find('button[type="submit"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Cerrar')
  })

  it('shows a save error and stays open', async () => {
    mockFetch({ '/v1/roles/role-Contador/permissions': () => json(400, { detail: 'Permiso desconocido' }) })
    const wrapper = mountModal()
    await switchFor(wrapper, 'accounting.ledger.close').trigger('click')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Permiso desconocido')
    expect(wrapper.emitted('saved')).toBeUndefined()
  })

  it('a module with no permissions says so', () => {
    const wrapper = mountModal({ module: { ...HR, permissions: [] } })
    expect(wrapper.text()).toContain('Este modulo no tiene permisos registrados.')
  })
})
