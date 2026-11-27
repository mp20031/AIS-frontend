import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import SidebarNav from '@/components/SidebarNav.vue'
import { env } from '@/config/env'
import { useSession } from '@/composables/useSession'
import { callsTo, json, mockFetch } from '@/services/__tests__/fetchMock'
import { testRouter } from '@/views/__tests__/testRouter'

const userinfo = (overrides: Record<string, unknown> = {}) => ({
  id: 'u1',
  username: 'jperez',
  display_name: 'Juan Pérez',
  email: 'jperez@example.com',
  active: true,
  roles: ['Administrador IAM'],
  permissions: ['iam.role.manage'],
  ...overrides,
})

async function mountSidebar(info?: ReturnType<typeof userinfo>, props = {}) {
  if (info) {
    sessionStorage.setItem(env.tokenKey, 'token')
    mockFetch({ '/v1/auth/userinfo': () => json(200, info) })
    await useSession().load()
  }
  const router = await testRouter('/dashboard')
  const wrapper = mount(SidebarNav, { props, global: { plugins: [router] } })
  return { wrapper, router }
}

describe('SidebarNav', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    useSession().clear()
  })

  it('shows the live name, initials and primary role', async () => {
    const { wrapper } = await mountSidebar(userinfo())
    expect(wrapper.get('.sidebar__profile strong').text()).toBe('Juan Pérez')
    expect(wrapper.get('.sidebar__initials').text()).toBe('JP')
    expect(wrapper.get('.sidebar__profile span').text()).toBe('Administrador IAM')
  })

  it('falls back to the login-time snapshot before userinfo arrives', async () => {
    sessionStorage.setItem('ais_user', JSON.stringify({ id: 'u1', username: 'jperez', name: 'J. Pérez', email: 'j@x' }))
    const { wrapper } = await mountSidebar()
    expect(wrapper.get('.sidebar__profile strong').text()).toBe('J. Pérez')
    expect(wrapper.get('.sidebar__profile span').text()).toBe('j@x')
  })

  it('shows "Usuario" when nothing is known', async () => {
    const { wrapper } = await mountSidebar()
    expect(wrapper.get('.sidebar__profile strong').text()).toBe('Usuario')
    expect(wrapper.get('.sidebar__initials').text()).toBe('U')
  })

  it('links Seguridad only for a user who can open it', async () => {
    let { wrapper } = await mountSidebar(userinfo())
    expect(wrapper.find('a[href="/seguridad"]').exists()).toBe(true)

    useSession().clear()
    ;({ wrapper } = await mountSidebar(userinfo({ permissions: ['payroll.planilla.view'] })))
    expect(wrapper.find('a[href="/seguridad"]').exists()).toBe(false)
    expect(wrapper.find('a[href="/dashboard"]').exists()).toBe(true)
  })

  it('the toggle button emits toggle and names what it does', async () => {
    const { wrapper } = await mountSidebar(undefined, { collapsed: true })
    const toggle = wrapper.get('.sidebar__toggle')
    expect(toggle.attributes('aria-label')).toBe('Expandir menu')
    await toggle.trigger('click')
    expect(wrapper.emitted('toggle')).toHaveLength(1)
  })

  it('logging out ends the session on the server and goes to login', async () => {
    const { wrapper, router } = await mountSidebar(userinfo())
    const fetchMock = mockFetch({ '/v1/auth/logout': () => json(204) })

    await wrapper.get('.sidebar__logout').trigger('click')
    await flushPromises()

    expect(callsTo(fetchMock, '/v1/auth/logout')).toHaveLength(1)
    expect(sessionStorage.getItem(env.tokenKey)).toBeNull()
    expect(useSession().user.value).toBeNull()
    expect(router.currentRoute.value.name).toBe('login')
  })
})
