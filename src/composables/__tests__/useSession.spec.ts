import { beforeEach, describe, expect, it, vi } from 'vitest'
import { env } from '@/config/env'
import { json, mockFetch } from '@/services/__tests__/fetchMock'

const replace = vi.fn()
vi.mock('@/router', () => ({ default: { replace } }))

const { useSession } = await import('@/composables/useSession')

const INFO = {
  id: 'u1',
  username: 'jperez',
  display_name: 'J. Pérez',
  email: null,
  active: true,
  roles: ['Administrador IAM'],
  permissions: ['iam.role.manage'],
}

describe('useSession', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    useSession().clear()
    replace.mockReset()
  })

  it('does nothing without a session', async () => {
    const fetchMock = mockFetch({})
    await useSession().load()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(useSession().user.value).toBeNull()
  })

  it('loads the live account once and shares it', async () => {
    sessionStorage.setItem(env.tokenKey, 't')
    const fetchMock = mockFetch({ '/v1/auth/userinfo': () => json(200, INFO) })

    await Promise.all([useSession().load(), useSession().load()])
    await useSession().load()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(useSession().user.value).toEqual(INFO)
    expect(useSession().loading.value).toBe(false)
  })

  it('force reloads', async () => {
    sessionStorage.setItem(env.tokenKey, 't')
    const fetchMock = mockFetch({ '/v1/auth/userinfo': () => json(200, INFO) })

    await useSession().load()
    await useSession().load(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('can() answers from the live permissions', async () => {
    sessionStorage.setItem(env.tokenKey, 't')
    mockFetch({ '/v1/auth/userinfo': () => json(200, INFO) })

    expect(useSession().can('iam.role.manage')).toBe(false)
    await useSession().load()
    expect(useSession().can('iam.role.manage')).toBe(true)
    expect(useSession().can('iam.user.create')).toBe(false)
  })

  it('a closed session drops the local one and goes to login', async () => {
    sessionStorage.setItem(env.tokenKey, 't')
    mockFetch({
      '/v1/auth/userinfo': () => json(401, { detail: 'La sesion fue cerrada' }),
      '/v1/auth/refresh': () => json(401),
    })

    await useSession().load()

    expect(sessionStorage.getItem(env.tokenKey)).toBeNull()
    expect(useSession().user.value).toBeNull()
    expect(replace).toHaveBeenCalledWith({ name: 'login' })
  })

  it('any other failure stays on screen as an error', async () => {
    sessionStorage.setItem(env.tokenKey, 't')
    mockFetch({ '/v1/auth/userinfo': () => json(500, { detail: 'Error interno' }) })

    await useSession().load()

    expect(useSession().error.value).toBe('Error interno')
    expect(sessionStorage.getItem(env.tokenKey)).toBe('t')
    expect(replace).not.toHaveBeenCalled()
  })
})
