import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import LaunchView from '@/views/LaunchView.vue'
import { json, mockFetch } from '@/services/__tests__/fetchMock'
import { testRouter } from './testRouter'

const realLocation = window.location

async function mountLaunch(moduleKey: string) {
  const replace = vi.fn()
  // jsdom cannot navigate; stand in a location whose replace() we can watch.
  Object.defineProperty(window, 'location', { configurable: true, value: { ...realLocation, replace } })
  const router = await testRouter(`/launch/${moduleKey}`)
  const wrapper = mount(LaunchView, { global: { plugins: [router] } })
  return { wrapper, replace }
}

describe('LaunchView', () => {
  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: realLocation })
  })

  it('asks for a code for the module and replaces the page with its callback', async () => {
    const fetchMock = mockFetch({
      '/v1/auth/handoff': () => json(200, { redirect_url: 'http://payroll.test/callback?code=abc', expires_in: 30 }),
    })
    const { wrapper, replace } = await mountLaunch('payroll')

    expect(wrapper.text()).toContain('Abriendo payroll')
    await flushPromises()

    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ module_key: 'payroll' })
    // replace, not assign: "back" from the module must not land here and relaunch.
    expect(replace).toHaveBeenCalledWith('http://payroll.test/callback?code=abc')
  })

  it('explains why the module could not be opened', async () => {
    mockFetch({ '/v1/auth/handoff': () => json(404, { detail: 'Esta aplicación no se puede abrir desde el portal' }) })
    const { wrapper, replace } = await mountLaunch('nope')
    await flushPromises()

    expect(wrapper.text()).toContain('No se pudo abrir la aplicación')
    expect(wrapper.text()).toContain('Esta aplicación no se puede abrir desde el portal')
    expect(wrapper.find('a').attributes('href')).toBe('/dashboard')
    expect(replace).not.toHaveBeenCalled()
  })
})
