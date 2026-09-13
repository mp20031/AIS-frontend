export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api',
  apiTimeoutMs: Number(import.meta.env.VITE_API_TIMEOUT_MS ?? 15000),
  tokenKey: import.meta.env.VITE_AUTH_TOKEN_KEY ?? 'ais_access_token',
}
