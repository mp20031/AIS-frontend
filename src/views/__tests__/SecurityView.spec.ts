import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { useSession } from '@/composables/useSession'
import { callsTo, json, mockFetch } from '@/services/__tests__/fetchMock'
import { orgUnit, role, signInAs, subject } from '@/components/security/__tests__/securityFixtures'

vi.mock('vue3-toastify', () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }))

const { default: SecurityView } = await import('@/views/SecurityView.vue')

const ROUTES = {
  '/v1/modules': () => json(200, []),
  '/v1/roles': () => json(200, [role('Contador')]),
  '/v1/subjects': () => json(200, [subject('user-88')]),
  '/v1/org-units': () => json(200, [orgUnit('div1', 'org1.div1'), orgUnit('org1', 'org1')]),
  '/v1/grants': () => json(200, []),
}

async function mountSecurity(permissions: string[], routes: Parameters<typeof mockFetch>[0] = {}) {
  await signInAs(permissions)
  const fetchMock = mockFetch({ ...ROUTES, ...routes })
  const wrapper = mount(SecurityView, {
    global: { directives: { autoAnimate: {} }, stubs: { teleport: true } },
  })
  await flushPromises()
  const tabs = () => wrapper.findAll('.tab-bar__item').map((t) => t.text())
  return { wrapper, fetchMock, tabs }
}

describe('SecurityView', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    useSession().clear()
  })

  it('a role manager starts on Roles and loads modules, roles and org units', async () => {
    const { wrapper, fetchMock, tabs } = await mountSecurity(['iam.role.manage'])

    expect(tabs()).toEqual(['Roles y Permisos'])
    expect(wrapper.get('h1').text()).toBe('Seguridad · Roles y Permisos')
    expect(callsTo(fetchMock, '/v1/modules')).toHaveLength(1)
    expect(callsTo(fetchMock, '/v1/subjects')).toHaveLength(0)
    expect(wrapper.findComponent({ name: 'RolesTab' }).exists()).toBe(true)
  })

  it('a user viewer starts on Users, and a 403 on roles is just an empty list', async () => {
    const { wrapper, fetchMock, tabs } = await mountSecurity(['iam.user.view'], {
      '/v1/roles': () => json(403, { detail: 'Falta iam.role.manage' }),
      '/v1/org-units': () => json(403, {}),
    })

    expect(tabs()).toEqual(['Usuarios'])
    expect(wrapper.get('h1').text()).toBe('Seguridad · Usuarios')
    expect(callsTo(fetchMock, '/v1/modules')).toHaveLength(0)
    expect(wrapper.find('.login-card__error').exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'UsersTab' }).props('roles')).toEqual([])
  })

  it('with both permissions, the tabs switch', async () => {
    const { wrapper, tabs } = await mountSecurity(['iam.role.manage', 'iam.user.view'])
    expect(tabs()).toEqual(['Roles y Permisos', 'Usuarios'])

    await wrapper.findAll('.tab-bar__item')[1].trigger('click')
    await flushPromises()
    expect(wrapper.get('h1').text()).toBe('Seguridad · Usuarios')
    expect(wrapper.findComponent({ name: 'UsersTab' }).exists()).toBe(true)
  })

  it('sorts org units by their path for the tree-shaped selects', async () => {
    const { wrapper } = await mountSecurity(['iam.user.view'])
    const units = wrapper.findComponent({ name: 'UsersTab' }).props('orgUnits') as { code: string }[]
    expect(units.map((u) => u.code)).toEqual(['org1', 'div1'])
  })

  it('a failure other than 403 is shown', async () => {
    const { wrapper } = await mountSecurity(['iam.role.manage'], {
      '/v1/modules': () => json(500, { detail: 'Error interno' }),
    })
    expect(wrapper.get('.login-card__error').text()).toBe('Error interno')
  })

  it('a reload keeps the tab mounted, so its selection survives', async () => {
    const { wrapper, fetchMock } = await mountSecurity(['iam.user.view'], {
      '/v1/subjects': () => json(200, [subject('ana'), subject('beto')]),
    })
    const tab = wrapper.findComponent({ name: 'UsersTab' })
    await wrapper.findAll('.role-row')[1].trigger('click')
    expect(wrapper.get('.security-card--hero h2').text()).toBe('beto')

    const reloads = callsTo(fetchMock, '/v1/subjects').length
    tab.vm.$emit('subjectsChanged')
    expect(wrapper.text()).not.toContain('Cargando usuarios...')
    await flushPromises()

    expect(callsTo(fetchMock, '/v1/subjects').length).toBe(reloads + 1)
    // Same component instance: not unmounted and mounted again.
    expect(wrapper.findComponent({ name: 'UsersTab' }).vm.$.uid).toBe(tab.vm.$.uid)
    expect(wrapper.get('.security-card--hero h2').text()).toBe('beto')
  })

  it('reloads the counts when the Users tab changes grants', async () => {
    const { wrapper, fetchMock } = await mountSecurity(['iam.user.view'])
    const before = callsTo(fetchMock, '/v1/subjects').length

    wrapper.findComponent({ name: 'UsersTab' }).vm.$emit('grantsChanged')
    await flushPromises()

    expect(callsTo(fetchMock, '/v1/subjects').length).toBe(before + 1)
  })
})
