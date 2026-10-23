import { beforeEach, describe, expect, it } from 'vitest'
import { env } from '@/config/env'
import { authService } from '@/services/authService'
import { callsTo, json, mockFetch } from './fetchMock'

const USER = { id: 'u1', username: 'jperez', name: 'J. Pérez', email: 'jperez@example.com' }
const LOGIN_OK = { token: 'access', token_type: 'Bearer', expires_in: 3600, user: USER }

describe('authService', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  describe('login', () => {
    it('sends the credentials and the remember choice', async () => {
      const fetchMock = mockFetch({ '/v1/auth/login': () => json(200, LOGIN_OK) })

      await authService.login({ email: 'jperez', password: 'secret', remember: false })

      const [, init] = fetchMock.mock.calls[0]
      expect(init?.method).toBe('POST')
      expect(JSON.parse(String(init?.body))).toEqual({ username: 'jperez', password: 'secret', remember: false })
      expect(init?.credentials).toBe('include')
    })

    it('remembered: the session goes to localStorage', async () => {
      mockFetch({ '/v1/auth/login': () => json(200, LOGIN_OK) })
      await authService.login({ email: 'jperez', password: 'x', remember: true })

      expect(localStorage.getItem(env.tokenKey)).toBe('access')
      expect(JSON.parse(localStorage.getItem('ais_user')!)).toEqual(USER)
      expect(sessionStorage.length).toBe(0)
    })

    it('not remembered: the session goes to sessionStorage', async () => {
      mockFetch({ '/v1/auth/login': () => json(200, LOGIN_OK) })
      await authService.login({ email: 'jperez', password: 'x', remember: false })

      expect(sessionStorage.getItem(env.tokenKey)).toBe('access')
      expect(localStorage.length).toBe(0)
    })

    it('stores nothing when the credentials are wrong', async () => {
      mockFetch({ '/v1/auth/login': () => json(401, { detail: 'Usuario o contraseña incorrectos' }) })

      await expect(authService.login({ email: 'jperez', password: 'bad', remember: true })).rejects.toThrow(
        'Usuario o contraseña incorrectos',
      )
      expect(authService.isAuthenticated()).toBe(false)
    })
  })

  describe('logout', () => {
    it('closes the session on the server, then forgets it here', async () => {
      localStorage.setItem(env.tokenKey, 'access')
      localStorage.setItem('ais_user', JSON.stringify(USER))
      const fetchMock = mockFetch({ '/v1/auth/logout': () => json(204) })

      await authService.logout()

      expect(callsTo(fetchMock, '/v1/auth/logout')).toHaveLength(1)
      expect(authService.isAuthenticated()).toBe(false)
      expect(authService.getCachedUser()).toBeNull()
    })

    it('still logs out locally when the API is down', async () => {
      sessionStorage.setItem(env.tokenKey, 'access')
      mockFetch({
        '/v1/auth/logout': () => Promise.reject(new TypeError('Failed to fetch')),
      })

      await authService.logout()
      expect(authService.isAuthenticated()).toBe(false)
    })

    it('does not call the API without a session', async () => {
      const fetchMock = mockFetch({})
      await authService.logout()
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  describe('getCachedUser', () => {
    it('returns the login-time snapshot', () => {
      sessionStorage.setItem('ais_user', JSON.stringify(USER))
      expect(authService.getCachedUser()).toEqual(USER)
    })

    it('drops a corrupt entry instead of throwing', () => {
      localStorage.setItem('ais_user', '{not json')
      expect(authService.getCachedUser()).toBeNull()
      expect(localStorage.getItem('ais_user')).toBeNull()
    })
  })

  it('fetchUserInfo reads the live account', async () => {
    const info = { id: 'u1', username: 'jperez', display_name: null, email: null, active: true, roles: [], permissions: [] }
    mockFetch({ '/v1/auth/userinfo': () => json(200, info) })
    await expect(authService.fetchUserInfo()).resolves.toEqual(info)
  })

  describe('restoreSession', () => {
    it('brings the session back from the refresh cookie', async () => {
      mockFetch({ '/v1/auth/refresh': () => json(200, { token: 'restored' }) })

      await expect(authService.restoreSession()).resolves.toBe(true)
      expect(authService.isAuthenticated()).toBe(true)
    })

    it('reports false when there is no session to restore', async () => {
      mockFetch({ '/v1/auth/refresh': () => json(401) })

      await expect(authService.restoreSession()).resolves.toBe(false)
      expect(authService.isAuthenticated()).toBe(false)
    })
  })
})
