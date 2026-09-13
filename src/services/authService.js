import { env } from '@/config/env'

const demoUser = {
  id: 1,
  name: 'Maria Fernanda Lopez',
  shortName: 'M',
  role: 'Administrador',
  email: 'j.perez@salesianos.edu.sv',
}

export const authService = {
  async login(credentials) {
    const token = `demo-token-${credentials.role}`
    localStorage.setItem(env.tokenKey, token)
    localStorage.setItem('ais_user', JSON.stringify(demoUser))
    return { token, user: demoUser }
  },

  logout() {
    localStorage.removeItem(env.tokenKey)
    localStorage.removeItem('ais_user')
  },

  getUser() {
    const user = localStorage.getItem('ais_user')
    return user ? JSON.parse(user) : demoUser
  },

  isAuthenticated() {
    return Boolean(localStorage.getItem(env.tokenKey))
  },
}
