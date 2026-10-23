import { expect, test } from '@playwright/test'
import { ADMIN, API_URL, breakAccessToken, login, refreshCookie, storedToken } from './helpers'

test.describe('logging in', () => {
  test('wrong credentials stay on the login page with the reason', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Usuario').fill(ADMIN.username)
    await page.getByLabel('Contraseña').fill('not-the-password')
    await page.getByRole('button', { name: 'Entrar al portal' }).click()

    await expect(page.getByText('Usuario o contraseña incorrectos')).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })

  test('the form starts empty', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByLabel('Usuario')).toHaveValue('')
    await expect(page.getByLabel('Contraseña')).toHaveValue('')
  })

  test('the refresh token lands in an httpOnly cookie the page cannot read', async ({ page, context }) => {
    await login(page, ADMIN)

    const cookie = await refreshCookie(context)
    expect(cookie).toBeDefined()
    expect(cookie!.httpOnly).toBe(true)
    expect(cookie!.sameSite).toBe('Strict')
    expect(cookie!.path).toBe('/v1/auth')
    expect(await page.evaluate(() => document.cookie)).not.toContain('iam_refresh')
  })

  test('"keep me signed in": persistent cookie, token in localStorage', async ({ page, context }) => {
    await login(page, ADMIN, { remember: true })

    const days = ((await refreshCookie(context))!.expires * 1000 - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(29)
    expect(await storedToken(page)).toMatchObject({ local: expect.any(String), session: null })
  })

  test('without it: a browser-session cookie, token in sessionStorage', async ({ page, context }) => {
    await login(page, ADMIN, { remember: false })

    expect((await refreshCookie(context))!.expires).toBe(-1)
    expect(await storedToken(page)).toMatchObject({ local: null, session: expect.any(String) })
  })
})

test.describe('staying logged in', () => {
  test('an expired access token is renewed without the user noticing', async ({ page }) => {
    await login(page, ADMIN)
    const before = (await storedToken(page)).local
    await breakAccessToken(page)

    const refreshed = page.waitForResponse((r) => r.url() === `${API_URL}/v1/auth/refresh` && r.status() === 200)
    await page.getByRole('link', { name: 'Seguridad' }).click()
    await refreshed

    await expect(page.getByRole('heading', { name: /Seguridad/ })).toBeVisible()
    const after = (await storedToken(page)).local
    expect(after).not.toBe('expired.or.invalid')
    expect(after).not.toBe(before)
  })

  test('a new tab picks the session up from the cookie', async ({ page, context }) => {
    await login(page, ADMIN, { remember: false })

    const tab = await context.newPage()
    await tab.goto('/dashboard')
    await expect(tab).toHaveURL(/\/dashboard/)
    await expect(tab.getByRole('heading', { name: 'Panel de Control Institucional' })).toBeVisible()
    expect((await storedToken(tab)).session).toEqual(expect.any(String))
  })

  test('a reload keeps the session', async ({ page }) => {
    await login(page, ADMIN)
    await page.reload()
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('the login page sends a logged-in user to the dashboard', async ({ page }) => {
    await login(page, ADMIN)
    await page.goto('/login')
    await expect(page).toHaveURL(/\/dashboard/)
  })
})

test.describe('logging out', () => {
  test('ends the session on the server: the cookie cannot bring it back', async ({ page, context }) => {
    await login(page, ADMIN)
    const cookieBefore = (await refreshCookie(context))!.value

    await page.getByRole('button', { name: 'Cerrar sesion' }).click()
    await expect(page).toHaveURL(/\/login/)
    expect(await refreshCookie(context)).toBeUndefined()

    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)

    // Even a copy of the old cookie is useless now.
    const replay = await page.request.post(`${API_URL}/v1/auth/refresh`, {
      headers: { Cookie: `iam_refresh=${cookieBefore}` },
    })
    expect(replay.status()).toBe(401)
  })

  test('a protected page without a session goes to login and comes back after', async ({ page }) => {
    await page.goto('/seguridad')
    await expect(page).toHaveURL(/\/login\?redirect=(%2F|\/)seguridad$/)

    await page.getByLabel('Usuario').fill(ADMIN.username)
    await page.getByLabel('Contraseña').fill(ADMIN.password)
    await page.getByRole('button', { name: 'Entrar al portal' }).click()
    await expect(page).toHaveURL(/\/seguridad/)
  })
})
