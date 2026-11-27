import { vi } from 'vitest'

/** A JSON `Response` the way iam-api would send it. */
export function json(status: number, body?: unknown): Response {
  if (status === 204) return new Response(null, { status })
  return new Response(body === undefined ? '' : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

type Route = (url: string, init: RequestInit) => Response | Promise<Response>

/**
 * Replace `fetch` with a router of canned answers, matched by path suffix
 * (longest first), with `'*'` as a catch-all. Each handler is a function of
 * the call, so a test can answer the first call one way and the retry
 * another. Unmatched calls fail loudly.
 */
export function mockFetch(routes: Record<string, Route>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input)
    const path =
      Object.keys(routes)
        .filter((candidate) => candidate !== '*')
        .sort((a, b) => b.length - a.length)
        .find((candidate) => new URL(url).pathname.endsWith(candidate)) ?? (routes['*'] ? '*' : undefined)
    if (!path) throw new Error(`Unexpected fetch: ${init.method ?? 'GET'} ${url}`)
    return routes[path](url, init)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** The Authorization header a call carried, if any. */
export function bearerOf(init: RequestInit | undefined): string | undefined {
  const headers = (init?.headers ?? {}) as Record<string, string>
  return headers.Authorization?.replace(/^Bearer /, '')
}

/** Calls whose URL path ends with `path`. */
export function callsTo(fetchMock: ReturnType<typeof mockFetch>, path: string) {
  return fetchMock.mock.calls.filter(([input]) => new URL(String(input)).pathname.endsWith(path))
}
