import { env } from '@/config/env'

const buildUrl = (path: string) => {
  if (/^https?:\/\//i.test(path)) return path
  return `${env.apiBaseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
}

export async function apiRequest<T = unknown>(path: string, options: RequestInit = {}): Promise<T | null> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), env.apiTimeoutMs)

  const token = localStorage.getItem(env.tokenKey)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }

  if (token) headers.Authorization = `Bearer ${token}`

  try {
    const response = await fetch(buildUrl(path), {
      ...options,
      headers,
      signal: controller.signal,
    })

    if (!response.ok) {
      const body = await response.text()
      let message = body
      try {
        message = JSON.parse(body).detail || message
      } catch {
        // body wasn't JSON, keep raw text
      }
      throw new Error(message || `HTTP ${response.status}`)
    }

    if (response.status === 204) return null
    return (await response.json()) as T
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('La solicitud tardó demasiado. Verifica tu conexión e intenta de nuevo.')
    }
    if (err instanceof TypeError) {
      throw new Error('No se pudo conectar con el servidor. Verifica tu conexión.')
    }
    throw err
  } finally {
    window.clearTimeout(timeout)
  }
}
