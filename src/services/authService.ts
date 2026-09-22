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

export interface LoginResponse {
  token: string
  user: AuthUser
}

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

    const { token, user } = response
    localStorage.setItem(env.tokenKey, token)
    localStorage.setItem('ais_user', JSON.stringify(user))
    return { token, user }
  },

  logout(): void {
    localStorage.removeItem(env.tokenKey)
    localStorage.removeItem('ais_user')
  },

  getUser(): AuthUser | null {
    const user = localStorage.getItem('ais_user')
    return user ? (JSON.parse(user) as AuthUser) : null
  },

  isAuthenticated(): boolean {
    return Boolean(localStorage.getItem(env.tokenKey))
  },
}
