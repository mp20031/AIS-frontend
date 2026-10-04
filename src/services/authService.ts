import { env } from '@/config/env'
import { apiRequest } from '@/services/httpClient'

export interface LoginCredentials {
  email: string
  password: string
}

export interface AuthUser {
  id: string
  username: string
  name: string | null
  email: string | null
}

/** `GET /v1/auth/userinfo` — the live account, not the login-time snapshot. */
export interface UserInfo {
  id: string
  username: string
  display_name: string | null
  email: string | null
  active: boolean
  roles: string[]
  permissions: string[]
}

export interface LoginResponse {
  token: string
  token_type: string
  expires_in: number
  user: AuthUser
}

const USER_CACHE_KEY = 'ais_user'

export const authService = {
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const response = await apiRequest<LoginResponse>('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: credentials.email,
        password: credentials.password,
      }),
    })

    if (!response) throw new Error('Respuesta invalida del servidor')

    localStorage.setItem(env.tokenKey, response.token)
    // Cached only so the shell can paint a name before userinfo resolves.
    // `fetchUserInfo` is the authoritative source once it lands.
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(response.user))
    return response
  },

  /**
   * Authoritative identity, read from the server on every app load.
   *
   * The sidebar used to render straight from the localStorage snapshot, which
   * went stale the moment the account changed — and kept rendering a session
   * whose roles had already been revoked. The server answers 401 when the
   * account is gone or deactivated, which is what lets us drop the session.
   */
  async fetchUserInfo(): Promise<UserInfo> {
    const info = await apiRequest<UserInfo>('/v1/auth/userinfo')
    if (!info) throw new Error('Respuesta invalida del servidor')
    return info
  },

  /**
   * End the session on the server, then forget it here.
   *
   * Removing the token from localStorage alone only made *this browser* forget
   * it: iam-api kept the session open until the token expired, and so did every
   * module session opened from the portal. `POST /v1/auth/logout` closes this
   * session and the module sessions it launched (FR-36).
   *
   * Best effort on purpose: if iam-api can't be reached, the user still gets
   * logged out locally — a logout button that sometimes doesn't log you out is
   * worse than a session that lingers until expiry.
   */
  async logout(): Promise<void> {
    if (localStorage.getItem(env.tokenKey)) {
      try {
        await apiRequest('/v1/auth/logout', { method: 'POST' })
      } catch {
        // Already closed (401), or the API is down: nothing more to do here.
      }
    }
    this.clearLocalSession()
  },

  /**
   * Forget the session in this browser only. For when the server has already
   * said the session is gone (a 401) — telling it again would be pointless.
   */
  clearLocalSession(): void {
    localStorage.removeItem(env.tokenKey)
    localStorage.removeItem(USER_CACHE_KEY)
  },

  /** Last known user, for first paint only. Never a basis for a permission decision. */
  getCachedUser(): AuthUser | null {
    const raw = localStorage.getItem(USER_CACHE_KEY)
    if (!raw) return null

    try {
      return JSON.parse(raw) as AuthUser
    } catch {
      // A corrupt entry used to throw straight through component setup and
      // break the whole shell, recoverable only by clearing site data by hand.
      localStorage.removeItem(USER_CACHE_KEY)
      return null
    }
  },

  isAuthenticated(): boolean {
    return Boolean(localStorage.getItem(env.tokenKey))
  },
}
