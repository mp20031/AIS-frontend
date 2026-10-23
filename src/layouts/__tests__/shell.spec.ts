import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '@/App.vue'
import AppShell from '@/layouts/AppShell.vue'
import { env } from '@/config/env'
import { useSession } from '@/composables/useSession'
import { callsTo, json, mockFetch } from '@/services/__tests__/fetchMock'

const Page = (text: string) => defineComponent({ render: () => h('p', { class: 'page' }, text) })

async function appRouter(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: Page('login page') },
      { path: '/dashboard', name: 'dashboard', component: Page('dashboard page'), meta: { requiresAuth: true, portalPadding: true } },
      { path: '/seguridad', name: 'seguridad', component: Page('security page'), meta: { requiresAuth: true } },
    ],
  })
  await router.push(path)
  await router.isReady()
  return router
}

const USERINFO = {
  id: 'u1',
  username: 'jperez',
  display_name: 'J. Pérez',
  email: null,
  active: true,
  roles: [],
  permissions: [],
}

describe('App', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    useSession().clear()
  })

  it('a public page renders bare, without the sidebar', async () => {
    const wrapper = mount(App, { global: { plugins: [await appRouter('/login')] } })
    await flushPromises()

    expect(wrapper.text()).toContain('login page')
    expect(wrapper.find('.sidebar').exists()).toBe(false)
  })

  it('an authenticated page renders inside the shell', async () => {
    sessionStorage.setItem(env.tokenKey, 't')
    mockFetch({ '/v1/auth/userinfo': () => json(200, USERINFO) })
    const wrapper = mount(App, { global: { plugins: [await appRouter('/dashboard')] } })
    await flushPromises()

    expect(wrapper.find('.sidebar').exists()).toBe(true)
    expect(wrapper.get('main').text()).toContain('dashboard page')
  })
})

describe('AppShell', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    useSession().clear()
  })

  it('loads the live account once, when it mounts', async () => {
    sessionStorage.setItem(env.tokenKey, 't')
    const fetchMock = mockFetch({ '/v1/auth/userinfo': () => json(200, USERINFO) })
    const wrapper = mount(AppShell, { global: { plugins: [await appRouter('/dashboard')] } })
    await flushPromises()

    expect(callsTo(fetchMock, '/v1/auth/userinfo')).toHaveLength(1)
    expect(wrapper.get('.sidebar__profile strong').text()).toBe('J. Pérez')
  })

  it('pads portal pages, and collapses the sidebar from its toggle', async () => {
    mockFetch({})
    const wrapper = mount(AppShell, { global: { plugins: [await appRouter('/dashboard')] } })
    await flushPromises()

    expect(wrapper.get('main').classes()).toContain('portal-content')
    await wrapper.get('.sidebar__toggle').trigger('click')
    expect(wrapper.get('.console-shell').classes()).toContain('console-shell--collapsed')
  })

  it('scrolls its own pane back to the top on navigation', async () => {
    mockFetch({})
    const router = await appRouter('/dashboard')
    const wrapper = mount(AppShell, { global: { plugins: [router] } })
    await flushPromises()
    const scrollTo = vi.fn()
    ;(wrapper.get('main').element as HTMLElement).scrollTo = scrollTo

    await router.push('/seguridad')
    await flushPromises()

    expect(scrollTo).toHaveBeenCalledWith({ top: 0 })
    expect(wrapper.get('main').classes()).not.toContain('portal-content')
  })
})
