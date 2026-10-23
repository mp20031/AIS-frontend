import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { json, mockFetch } from '@/services/__tests__/fetchMock'
import { testRouter } from './testRouter'

const toast = vi.hoisted(() => ({ warning: vi.fn(), success: vi.fn(), error: vi.fn() }))
vi.mock('vue3-toastify', () => ({ toast }))

const { default: DashboardView } = await import('@/views/DashboardView.vue')

const module = (overrides: Record<string, unknown> = {}) => ({
  id: 'm1',
  key: 'payroll',
  name: 'Planilla',
  permission_codes: ['payroll.planilla.view'],
  launchable: true,
  ...overrides,
})

async function mountDashboard(path = '/dashboard') {
  const router = await testRouter(path)
  const wrapper = mount(DashboardView, {
    global: { plugins: [router], directives: { autoAnimate: {} } },
  })
  await flushPromises()
  return { wrapper, router }
}

describe('DashboardView', () => {
  it('lists the modules the user can reach, with a link for launchable ones', async () => {
    mockFetch({
      '/v1/me/modules': () =>
        json(200, [module(), module({ id: 'm2', key: 'accounting', name: 'Contabilidad', launchable: false })]),
    })
    const { wrapper } = await mountDashboard()

    const cards = wrapper.findAll('.module-status')
    expect(cards).toHaveLength(2)
    expect(cards[0].get('a').attributes('href')).toBe('/launch/payroll')
    expect(cards[0].get('a').attributes('aria-label')).toBe('Abrir Planilla')
    expect(cards[1].find('a').exists()).toBe(false)
    expect(cards[1].text()).toContain('Contabilidad')
  })

  it('shows the first permissions sorted, and the rest on demand', async () => {
    const codes = ['p.e', 'p.a', 'p.d', 'p.b', 'p.c']
    mockFetch({ '/v1/me/modules': () => json(200, [module({ permission_codes: codes })]) })
    const { wrapper } = await mountDashboard()

    const shown = () => wrapper.findAll('.module-perms__list li').map((li) => li.text())
    expect(wrapper.get('.module-perms__count').text()).toBe('5 permisos')
    expect(shown()).toEqual(['p.a', 'p.b', 'p.c'])

    const toggle = wrapper.get('.module-perms__toggle')
    expect(toggle.text()).toBe('+2 más')
    await toggle.trigger('click')
    expect(shown()).toEqual(['p.a', 'p.b', 'p.c', 'p.d', 'p.e'])
    expect(toggle.text()).toBe('Ver menos')
    expect(toggle.attributes('aria-expanded')).toBe('true')
  })

  it('says "permiso" for one, and has no toggle for three or fewer', async () => {
    mockFetch({ '/v1/me/modules': () => json(200, [module()]) })
    const { wrapper } = await mountDashboard()
    expect(wrapper.get('.module-perms__count').text()).toBe('1 permiso')
    expect(wrapper.find('.module-perms__toggle').exists()).toBe(false)
  })

  it('explains an empty list', async () => {
    mockFetch({ '/v1/me/modules': () => json(200, []) })
    const { wrapper } = await mountDashboard()
    expect(wrapper.text()).toContain('Tu usuario no tiene permisos asignados en ningun modulo todavia.')
  })

  it('shows a loading error', async () => {
    mockFetch({ '/v1/me/modules': () => json(500, { detail: 'Error interno' }) })
    const { wrapper } = await mountDashboard()
    expect(wrapper.get('.login-card__error').text()).toBe('Error interno')
  })

  it('warns once when Seguridad was refused, and clears the notice from the URL', async () => {
    mockFetch({ '/v1/me/modules': () => json(200, []) })
    const { router } = await mountDashboard('/dashboard?notice=security-permission')

    expect(toast.warning).toHaveBeenCalledWith(
      'No tienes permisos para acceder al módulo de Seguridad.',
      expect.anything(),
    )
    expect(router.currentRoute.value.query).toEqual({})
  })
})
