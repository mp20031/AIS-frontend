import { beforeEach, describe, expect, it, vi } from 'vitest'
import { env } from '@/config/env'
import { ApiError, apiRequest, refreshAccessToken } from '@/services/httpClient'
import { bearerOf, callsTo, json, mockFetch } from './fetchMock'

const EXPIRED = 'expired-token'
const RENEWED = 'renewed-token'

/** The error a call rejects with; the test fails if the call succeeds instead. */
const rejectionOf = (call: Promise<unknown>) =>
  call.then(
    () => {
      throw new Error('expected the call to fail')
    },
    (error: unknown) => error as ApiError,
  )

describe('apiRequest', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('sends the stored token and the refresh cookie', async () => {
    sessionStorage.setItem(env.tokenKey, 'abc')
    const fetchMock = mockFetch({ '/v1/me': () => json(200, { ok: true }) })

    await expect(apiRequest('/v1/me')).resolves.toEqual({ ok: true })

    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe(`${env.apiBaseUrl.replace(/\/$/, '')}/v1/me`)
    expect(bearerOf(init)).toBe('abc')
    expect(init?.credentials).toBe('include')
  })

  it('sends no Authorization header without a token', async () => {
    const fetchMock = mockFetch({ '/v1/me': () => json(200, {}) })
    await apiRequest('/v1/me')
    expect(bearerOf(fetchMock.mock.calls[0][1])).toBeUndefined()
  })

  it('returns null for 204 No Content', async () => {
    mockFetch({ '/v1/x': () => json(204) })
    await expect(apiRequest('/v1/x', { method: 'DELETE' })).resolves.toBeNull()
  })

  describe('errors', () => {
    it('carries the status and the API detail', async () => {
      mockFetch({ '/v1/x': () => json(409, { detail: "El usuario 'diego' ya existe" }) })

      const error = await rejectionOf(apiRequest('/v1/x'))
      expect(error).toBeInstanceOf(ApiError)
      expect(error.status).toBe(409)
      expect(error.message).toBe("El usuario 'diego' ya existe")
    })

    it('turns a FastAPI 422 into readable text, not [object Object]', async () => {
      mockFetch({
        '/v1/subjects': () =>
          json(422, {
            detail: [
              { type: 'missing', loc: ['body', 'password'], msg: 'Field required' },
              { type: 'string_too_short', loc: ['body', 'username'], msg: '...', ctx: { min_length: 3 } },
              { type: 'string_too_long', loc: ['body', 'email'], msg: '...', ctx: { max_length: 200 } },
              {
                type: 'value_error',
                loc: ['body', 'username'],
                msg: 'Value error, El usuario solo admite letras',
              },
              { type: 'other', loc: ['query', 'limit'], msg: 'Input should be a valid integer' },
            ],
          }),
      })

      const error = await rejectionOf(apiRequest('/v1/subjects', { method: 'POST' }))
      expect(error.message).toBe(
        'Contraseña: campo obligatorio. ' +
          'Usuario: mínimo 3 caracteres. ' +
          'Correo: máximo 200 caracteres. ' +
          'Usuario: El usuario solo admite letras. ' +
          'limit: Input should be a valid integer',
      )
    })

    it('replaces a 403 detail with a fixed message', async () => {
      mockFetch({ '/v1/x': () => json(403, { detail: 'Falta el permiso iam.role.manage' }) })
      const error = await rejectionOf(apiRequest('/v1/x'))
      expect(error.status).toBe(403)
      expect(error.message).toBe('No tienes permiso para esta acción')
    })

    it('keeps a body that is not JSON as the message', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => new Response('Bad Gateway', { status: 502 })))
      const error = await rejectionOf(apiRequest('/v1/x'))
      expect(error.message).toBe('Bad Gateway')
    })

    it('falls back to the status for an empty body', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })))
      const error = await rejectionOf(apiRequest('/v1/x'))
      expect(error.message).toBe('HTTP 500')
    })

    it('explains a network failure', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
      await expect(apiRequest('/v1/x')).rejects.toThrow('No se pudo conectar con el servidor')
    })

    it('explains a timeout', async () => {
      vi.useFakeTimers()
      vi.stubGlobal(
        'fetch',
        vi.fn(
          (_url: string, init: RequestInit) =>
            new Promise((_, reject) => {
              init.signal?.addEventListener('abort', () =>
                reject(new DOMException('The operation was aborted.', 'AbortError')),
              )
            }),
        ),
      )

      const pending = rejectionOf(apiRequest('/v1/x'))
      await vi.advanceTimersByTimeAsync(env.apiTimeoutMs)
      expect((await pending).message).toContain('tardó demasiado')
      vi.useRealTimers()
    })
  })

  describe('renewing an expired access token', () => {
    it('refreshes once and retries with the new token', async () => {
      sessionStorage.setItem(env.tokenKey, EXPIRED)
      const fetchMock = mockFetch({
        '/v1/me': (_url, init) =>
          bearerOf(init) === RENEWED ? json(200, { me: true }) : json(401, { detail: 'Token invalido o expirado' }),
        '/v1/auth/refresh': () => json(200, { token: RENEWED }),
      })

      await expect(apiRequest('/v1/me')).resolves.toEqual({ me: true })

      expect(callsTo(fetchMock, '/v1/auth/refresh')).toHaveLength(1)
      expect(callsTo(fetchMock, '/v1/me')).toHaveLength(2)
      expect(sessionStorage.getItem(env.tokenKey)).toBe(RENEWED)
    })

    it('sends the refresh with credentials, so the cookie goes along', async () => {
      sessionStorage.setItem(env.tokenKey, EXPIRED)
      const fetchMock = mockFetch({
        '/v1/me': (_url, init) => (bearerOf(init) === RENEWED ? json(200, {}) : json(401)),
        '/v1/auth/refresh': () => json(200, { token: RENEWED }),
      })

      await apiRequest('/v1/me')

      const [, init] = callsTo(fetchMock, '/v1/auth/refresh')[0]
      expect(init?.method).toBe('POST')
      expect(init?.credentials).toBe('include')
    })

    it('keeps a remembered token in localStorage', async () => {
      localStorage.setItem(env.tokenKey, EXPIRED)
      mockFetch({
        '/v1/me': (_url, init) => (bearerOf(init) === RENEWED ? json(200, {}) : json(401)),
        '/v1/auth/refresh': () => json(200, { token: RENEWED }),
      })

      await apiRequest('/v1/me')

      expect(localStorage.getItem(env.tokenKey)).toBe(RENEWED)
      expect(sessionStorage.getItem(env.tokenKey)).toBeNull()
    })

    it('lets the 401 through when the session is over', async () => {
      sessionStorage.setItem(env.tokenKey, EXPIRED)
      const fetchMock = mockFetch({
        '/v1/me': () => json(401, { detail: 'La sesion fue cerrada' }),
        '/v1/auth/refresh': () => json(401, { detail: 'La sesion expiro' }),
      })

      const error = await rejectionOf(apiRequest('/v1/me'))
      expect(error.status).toBe(401)
      expect(error.message).toBe('La sesion fue cerrada')
      expect(callsTo(fetchMock, '/v1/me')).toHaveLength(1)
      expect(sessionStorage.getItem(env.tokenKey)).toBe(EXPIRED)
    })

    it('does not loop when the retry is refused too', async () => {
      sessionStorage.setItem(env.tokenKey, EXPIRED)
      const fetchMock = mockFetch({
        '/v1/me': () => json(401),
        '/v1/auth/refresh': () => json(200, { token: RENEWED }),
      })

      await expect(apiRequest('/v1/me')).rejects.toMatchObject({ status: 401 })
      expect(callsTo(fetchMock, '/v1/me')).toHaveLength(2)
      expect(callsTo(fetchMock, '/v1/auth/refresh')).toHaveLength(1)
    })

    it('shares one refresh between requests that fail together', async () => {
      sessionStorage.setItem(env.tokenKey, EXPIRED)
      let release!: () => void
      const gate = new Promise<void>((resolve) => (release = resolve))
      const fetchMock = mockFetch({
        '/v1/a': (_url, init) => (bearerOf(init) === RENEWED ? json(200, 'a') : json(401)),
        '/v1/b': (_url, init) => (bearerOf(init) === RENEWED ? json(200, 'b') : json(401)),
        '/v1/auth/refresh': async () => {
          await gate
          return json(200, { token: RENEWED })
        },
      })

      const both = Promise.all([apiRequest('/v1/a'), apiRequest('/v1/b')])
      await vi.waitFor(() => expect(callsTo(fetchMock, '/v1/auth/refresh')).toHaveLength(1))
      release()

      await expect(both).resolves.toEqual(['a', 'b'])
      expect(callsTo(fetchMock, '/v1/auth/refresh')).toHaveLength(1)
    })

    it('never refreshes without a token to renew', async () => {
      const fetchMock = mockFetch({ '/v1/me': () => json(401) })
      await expect(apiRequest('/v1/me')).rejects.toMatchObject({ status: 401 })
      expect(callsTo(fetchMock, '/v1/auth/refresh')).toHaveLength(0)
    })

    it.each(['/v1/auth/login', '/v1/auth/refresh'])('never refreshes a 401 from %s', async (path) => {
      sessionStorage.setItem(env.tokenKey, EXPIRED)
      const fetchMock = mockFetch({ [path]: () => json(401, { detail: 'Usuario o contraseña incorrectos' }) })

      await expect(apiRequest(path, { method: 'POST' })).rejects.toMatchObject({ status: 401 })
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })
})

describe('refreshAccessToken', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('stores the new token and returns it', async () => {
    mockFetch({ '/v1/auth/refresh': () => json(200, { token: RENEWED }) })
    await expect(refreshAccessToken()).resolves.toBe(RENEWED)
    expect(sessionStorage.getItem(env.tokenKey)).toBe(RENEWED)
  })

  it('returns null when the cookie is refused', async () => {
    mockFetch({ '/v1/auth/refresh': () => json(401) })
    await expect(refreshAccessToken()).resolves.toBeNull()
  })

  it('returns null when the API is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    await expect(refreshAccessToken()).resolves.toBeNull()
  })

  it('can run again once the previous refresh settled', async () => {
    const fetchMock = mockFetch({ '/v1/auth/refresh': () => json(200, { token: RENEWED }) })
    await refreshAccessToken()
    await refreshAccessToken()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
