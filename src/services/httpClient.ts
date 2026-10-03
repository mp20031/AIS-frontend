import { env } from '@/config/env'

const buildUrl = (path: string) => {
  if (/^https?:\/\//i.test(path)) return path

  return `${env.apiBaseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
}

/**
 * An error the API answered with, carrying its status code.
 *
 * Callers need to tell a 401 (session is gone — drop it and go to login) from
 * a 403 (signed in, just not allowed — show the message and stay put).
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T | null> {
  const controller = new AbortController()

  const timeout = window.setTimeout(
    () => controller.abort(),
    env.apiTimeoutMs,
  )

  const token = localStorage.getItem(env.tokenKey)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

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
        const parsed = JSON.parse(body)
        message = parsed.detail || message
      } catch {
        // El body no era JSON, conservamos el texto recibido.
      }

      /**
       * 403:
       * El usuario sigue autenticado, pero ya no tiene permiso
       * para ejecutar esta acción.
       *
       * Usamos un mensaje controlado para no mostrar mensajes
       * técnicos o inconsistentes enviados por la API.
       */
      if (response.status === 403) {
        throw new ApiError(
          'No tienes permiso para esta acción',
          response.status,
        )
      }

      throw new ApiError(
        message || `HTTP ${response.status}`,
        response.status,
      )
    }

    if (response.status === 204) {
      return null
    }

    return (await response.json()) as T
  } catch (err) {
    if (
      err instanceof DOMException &&
      err.name === 'AbortError'
    ) {
      throw new Error(
        'La solicitud tardó demasiado. Verifica tu conexión e intenta de nuevo.',
      )
    }

    if (err instanceof TypeError) {
      throw new Error(
        'No se pudo conectar con el servidor. Verifica tu conexión.',
      )
    }

    throw err
  } finally {
    window.clearTimeout(timeout)
  }
}