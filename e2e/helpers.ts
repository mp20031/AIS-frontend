import { expect, type BrowserContext, type Page } from '@playwright/test'

export const API_URL = process.env.E2E_API_URL ?? 'http://localhost:8010'
export const TOKEN_KEY = 'ais_access_token'
export const REFRESH_COOKIE = 'iam_refresh'

/** The seeded accounts (database/02_seed_data.sql). */
export const ADMIN = {
  username: process.env.E2E_ADMIN_USER ?? 'jperez',
  password: process.env.E2E_ADMIN_PASSWORD ?? 'changeme',
}
export const PLAIN = {
  username: process.env.E2E_PLAIN_USER ?? 'user-88',
  password: process.env.E2E_PLAIN_PASSWORD ?? 'changeme',
}

export async function login(page: Page, user: { username: string; password: string }, { remember = true } = {}) {
  await page.goto('/login')
  await page.getByLabel('Usuario').fill(user.username)
  await page.getByLabel('Contraseña').fill(user.password)
  await page.getByLabel('Mantener sesion iniciada').setChecked(remember)
  await page.getByRole('button', { name: 'Entrar al portal' }).click()
  await expect(page).toHaveURL(/\/dashboard/)
}

export async function refreshCookie(context: BrowserContext) {
  // Asked for the refresh URL itself: the cookie's Path is /v1/auth, so the
  // API's root would not list it.
  const cookies = await context.cookies(`${API_URL}/v1/auth/refresh`)
  return cookies.find((cookie) => cookie.name === REFRESH_COOKIE)
}

/** Where the portal keeps the access token, and what it is. */
export async function storedToken(page: Page) {
  return page.evaluate((key) => ({ local: localStorage.getItem(key), session: sessionStorage.getItem(key) }), TOKEN_KEY)
}

/** Overwrite the stored access token with one iam-api will refuse, as an expired one would be. */
export async function breakAccessToken(page: Page) {
  await page.evaluate((key) => {
    const store = localStorage.getItem(key) !== null ? localStorage : sessionStorage
    store.setItem(key, 'expired.or.invalid')
  }, TOKEN_KEY)
}

/** A name no earlier run has used: the database outlives the test run. */
export const uniqueName = (prefix: string) => `${prefix}-${Date.now().toString(36)}`
