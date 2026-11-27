import { beforeEach, describe, expect, it } from 'vitest'
import { env } from '@/config/env'
import router from '@/router'
import { useSession } from '@/composables/useSession'
import { callsTo, json, mockFetch } from '@/services/__tests__/fetchMock'

const userinfo = (permissions: string[]) => ({
  id: 'u1',
  username: 'jperez',
  display_name: null,
  email: null,
  active: true,
  roles: [],
  permissions,
})

async function go(path: string) {
  await router.push(path)
  return router.currentRoute.value
}

describe('router guards', () => {
  beforeEach(async () => {
    localStorage.clear()
    sessionStorage.clear()
    useSession().clear()
    // Park on the login page with no session, so each test starts from there.
    mockFetch({ '/v1/auth/refresh': () => json(401) })
    await router.replace('/login')
  })

  it('/ goes to the login page', async () => {
    expect((await go('/')).name).toBe('login')
  })

  describe('without a session', () => {
    it('the dashboard sends you to login, without a redirect back', async () => {
      const route = await go('/dashboard')
      expect(route.name).toBe('login')
      expect(route.query).toEqual({})
    })

    it('any other page sends you to login, and back afterwards', async () => {
      const route = await go('/launch/payroll')
      expect(route.name).toBe('login')
      expect(route.query.redirect).toBe('/launch/payroll')
    })

    it('tries the refresh cookie before giving up', async () => {
      const fetchMock = mockFetch({ '/v1/auth/refresh': () => json(401) })
      await go('/dashboard')
      expect(callsTo(fetchMock, '/v1/auth/refresh')).toHaveLength(1)
    })

    it('a live refresh cookie brings the session back (a new tab)', async () => {
      mockFetch({ '/v1/auth/refresh': () => json(200, { token: 'restored' }) })

      expect((await go('/dashboard')).name).toBe('dashboard')
      expect(sessionStorage.getItem(env.tokenKey)).toBe('restored')
    })
  })

  describe('with a session', () => {
    beforeEach(() => {
      sessionStorage.setItem(env.tokenKey, 'token')
    })

    it('the login page sends you to the dashboard', async () => {
      await router.replace('/dashboard')
      await go('/login')
      expect(router.currentRoute.value.name).toBe('dashboard')
    })

    it('does not call refresh when a token is already here', async () => {
      const fetchMock = mockFetch({})
      await go('/dashboard')
      expect(callsTo(fetchMock, '/v1/auth/refresh')).toHaveLength(0)
    })

    it('Seguridad opens for a user with a security permission', async () => {
      mockFetch({ '/v1/auth/userinfo': () => json(200, userinfo(['iam.user.view'])) })
      expect((await go('/seguridad')).name).toBe('seguridad')
    })

    it('Seguridad without the permission goes back to the dashboard with a notice', async () => {
      mockFetch({ '/v1/auth/userinfo': () => json(200, userinfo(['accounting.invoice.approve'])) })

      const route = await go('/seguridad')
      expect(route.name).toBe('dashboard')
      expect(route.query.notice).toBe('security-permission')
    })
  })
})
