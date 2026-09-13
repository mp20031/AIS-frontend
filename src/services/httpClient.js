import { env } from '@/config/env'

const buildUrl = (path) => {
  if (/^https?:\/\//i.test(path)) return path
  return `${env.apiBaseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
}

export async function apiRequest(path, options = {}) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), env.apiTimeoutMs)

  const token = localStorage.getItem(env.tokenKey)
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...options.headers,
  }

  if (token) headers.Authorization = `Bearer ${token}`

  try {
    const response = await fetch(buildUrl(path), {
      ...options,
      headers,
      signal: controller.signal,
    })

    if (!response.ok) {
      const message = await response.text()
      throw new Error(message || `HTTP ${response.status}`)
    }

    if (response.status === 204) return null
    return response.json()
  } finally {
    window.clearTimeout(timeout)
  }
}
