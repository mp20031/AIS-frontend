import { env } from '@/config/env'
import { authStorage } from '@/services/authStorage'

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

interface ValidationIssue {
  type: string
  loc: (string | number)[]
  msg: string
  ctx?: Record<string, unknown>
}

const FIELD_LABELS: Record<string, string> = {
  username: 'Usuario',
  password: 'Contraseña',
  display_name: 'Nombre',
  email: 'Correo',
}

const describeIssue = (issue: ValidationIssue): string => {
  const field = String(issue.loc[issue.loc.length - 1] ?? '')
  const label = FIELD_LABELS[field] ?? field

  switch (issue.type) {
    case 'missing':
      return `${label}: campo obligatorio`
    case 'string_too_short':
      return `${label}: mínimo ${issue.ctx?.min_length} caracteres`
    case 'string_too_long':
      return `${label}: máximo ${issue.ctx?.max_length} caracteres`
    default:
      // Our own validators already return the text in Spanish.
      return `${label}: ${issue.msg.replace(/^Value error, /, '')}`
  }
}

/**
 * `detail` is a string in our own errors (409, 404...), but in a FastAPI 422
 * it is a list of validation issues: it has to be turned into text, or the
 * message ends up as "[object Object]".
 */
const describeDetail = (detail: unknown): string | null => {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map(describeIssue).join('. ')
  return null
}

// A 401 from these means the credentials themselves failed; refreshing and
// retrying would only repeat the same answer.
const NO_REFRESH_PATHS = ['/v1/auth/login', '/v1/auth/refresh']

let refreshing: Promise<string | null> | null = null

/**
 * Trade the refresh cookie for a new access token (FR-33). Resolves to the new
 * token, or null when the session is over and the user has to log in again.
 *
 * One at a time: when several requests fail together they share a single
 * refresh, because every refresh rotates the cookie, and a second one racing
 * it would present the token the first one just retired.
 */
export function refreshAccessToken(): Promise<string | null> {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const response = await fetch(buildUrl('/v1/auth/refresh'), {
          method: 'POST',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        })
        if (!response.ok) return null

        const { token } = (await response.json()) as { token: string }
        authStorage.replace(env.tokenKey, token)
        return token
      } catch {
        return null
      } finally {
        refreshing = null
      }
    })()
  }
  return refreshing
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

  const send = (token: string | null) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    return fetch(buildUrl(path), {
      ...options,
      headers,
      // The refresh cookie only ever goes to /v1/auth (its Path), but the
      // browser needs this to send or store it on a cross-origin call.
      credentials: 'include',
      signal: controller.signal,
    })
  }

  try {
    const token = authStorage.get(env.tokenKey)
    let response = await send(token)

    // An expired access token: renew it once and retry. If the refresh fails
    // too, the 401 below reaches the caller, which ends the session.
    if (response.status === 401 && token && !NO_REFRESH_PATHS.includes(path)) {
      const renewed = await refreshAccessToken()
      if (renewed) response = await send(renewed)
    }

    if (!response.ok) {
      const body = await response.text()

      let message = body

      try {
        const parsed = JSON.parse(body)
        message = describeDetail(parsed.detail) || message
      } catch {
        // The body wasn't JSON; keep the text as received.
      }

      /**
       * 403:
       * The user is still authenticated, but no longer has
       * permission to perform this action.
       *
       * We use a fixed message so we don't show technical or
       * inconsistent messages sent by the API.
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