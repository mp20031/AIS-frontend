import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import LoginView from '@/views/LoginView.vue'
import { env } from '@/config/env'
import { json, mockFetch } from '@/services/__tests__/fetchMock'
import { testRouter } from './testRouter'

const LOGIN_OK = {
  token: 'access',
  token_type: 'Bearer',
  expires_in: 3600,
  user: { id: 'u1', username: 'jperez', name: null, email: null },
}

async function mountLogin(path = '/login') {
  const router = await testRouter(path)
  const wrapper = mount(LoginView, { global: { plugins: [router] } })
  const fill = async (username: string, password: string) => {
    await wrapper.get('input[autocomplete="username"]').setValue(username)
    await wrapper.get('input[type="password"]').setValue(password)
  }
  const submit = async () => {
    await wrapper.get('form').trigger('submit')
    await flushPromises()
  }
  return { wrapper, router, fill, submit }
}

describe('LoginView', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('starts empty, with "keep me signed in" checked', async () => {
    const { wrapper } = await mountLogin()
    expect((wrapper.get('input[autocomplete="username"]').element as HTMLInputElement).value).toBe('')
    expect((wrapper.get('input[type="password"]').element as HTMLInputElement).value).toBe('')
    expect((wrapper.get('input[type="checkbox"]').element as HTMLInputElement).checked).toBe(true)
  })

  it('asks for the username before calling the API', async () => {
    const fetchMock = mockFetch({})
    const { wrapper, fill, submit } = await mountLogin()
    await fill('   ', 'secret')
    await submit()

    expect(wrapper.text()).toContain('Ingresa tu usuario o correo institucional.')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('asks for the password before calling the API', async () => {
    const fetchMock = mockFetch({})
    const { wrapper, fill, submit } = await mountLogin()
    await fill('jperez', '')
    await submit()

    expect(wrapper.text()).toContain('Ingresa tu contraseña.')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('logs in and goes to the dashboard', async () => {
    const fetchMock = mockFetch({ '/v1/auth/login': () => json(200, LOGIN_OK) })
    const { router, fill, submit } = await mountLogin()
    await fill('jperez', 'secret')
    await submit()

    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      username: 'jperez',
      password: 'secret',
      remember: true,
    })
    expect(router.currentRoute.value.name).toBe('dashboard')
    expect(localStorage.getItem(env.tokenKey)).toBe('access')
  })

  it('unchecking "keep me signed in" sends remember=false', async () => {
    const fetchMock = mockFetch({ '/v1/auth/login': () => json(200, LOGIN_OK) })
    const { wrapper, fill, submit } = await mountLogin()
    await fill('jperez', 'secret')
    await wrapper.get('input[type="checkbox"]').setValue(false)
    await submit()

    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).remember).toBe(false)
    expect(sessionStorage.getItem(env.tokenKey)).toBe('access')
  })

  it('goes back to the page that sent you here', async () => {
    mockFetch({ '/v1/auth/login': () => json(200, LOGIN_OK) })
    const { router, fill, submit } = await mountLogin('/login?redirect=/seguridad')
    await fill('jperez', 'secret')
    await submit()
    expect(router.currentRoute.value.fullPath).toBe('/seguridad')
  })

  it.each(['//evil.example', 'https://evil.example', 'javascript:alert(1)'])(
    'refuses %s as a redirect (no open redirect)',
    async (target) => {
      mockFetch({ '/v1/auth/login': () => json(200, LOGIN_OK) })
      const { router, fill, submit } = await mountLogin(`/login?redirect=${encodeURIComponent(target)}`)
      await fill('jperez', 'secret')
      await submit()
      expect(router.currentRoute.value.name).toBe('dashboard')
    },
  )

  it('shows the API error and lets you try again', async () => {
    mockFetch({ '/v1/auth/login': () => json(401, { detail: 'Usuario o contraseña incorrectos' }) })
    const { wrapper, router, fill, submit } = await mountLogin()
    await fill('jperez', 'wrong')
    await submit()

    expect(wrapper.text()).toContain('Usuario o contraseña incorrectos')
    expect(router.currentRoute.value.name).toBe('login')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined()
  })

  it('disables the button while logging in', async () => {
    let answer!: (r: Response) => void
    mockFetch({ '/v1/auth/login': () => new Promise<Response>((resolve) => (answer = resolve)) })
    const { wrapper, fill } = await mountLogin()
    await fill('jperez', 'secret')
    await wrapper.get('form').trigger('submit')

    const button = wrapper.get('button[type="submit"]')
    expect(button.attributes('disabled')).toBeDefined()
    expect(button.text()).toBe('Ingresando...')

    answer(json(200, LOGIN_OK))
    await flushPromises()
  })
})
