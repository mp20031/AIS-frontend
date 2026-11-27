import { expect, test, type Page } from '@playwright/test'
import { ADMIN, PLAIN, login, uniqueName } from './helpers'

async function openUsersTab(page: Page) {
  await page.getByRole('link', { name: 'Seguridad' }).click()
  await page.getByRole('button', { name: 'Usuarios', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Seguridad · Usuarios' })).toBeVisible()
}

async function createUser(page: Page, username: string, password: string) {
  await page.getByRole('button', { name: 'Agregar usuario' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nuevo Usuario' })
  await dialog.getByPlaceholder('p. ej. jperez', { exact: true }).fill(username)
  await dialog.getByPlaceholder('p. ej. Juan Perez').fill('Prueba E2E')
  await dialog.locator('input[type="password"]').fill(password)
  await dialog.getByRole('button', { name: 'Crear' }).click()
  return dialog
}

test('a user without security permissions is turned away from Seguridad', async ({ page }) => {
  await login(page, PLAIN)
  await expect(page.getByRole('link', { name: 'Seguridad' })).toHaveCount(0)

  await page.goto('/seguridad')
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByText('No tienes permisos para acceder al módulo de Seguridad.')).toBeVisible()
})

test('creating a user: short password refused, then created, then able to log in', async ({ page, browser }) => {
  const username = uniqueName('e2e')
  const password = 'una-clave-larga-e2e'

  await login(page, ADMIN)
  await openUsersTab(page)

  const dialog = await createUser(page, username, 'corta')
  await expect(dialog.getByText('La contraseña debe tener al menos 12 caracteres.')).toBeVisible()

  await dialog.locator('input[type="password"]').fill(password)
  await dialog.getByRole('button', { name: 'Crear' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('heading', { name: username, level: 2 })).toBeVisible()

  // The account works: a separate browser logs in with it.
  const other = await browser.newContext()
  const otherPage = await other.newPage()
  await login(otherPage, { username, password })
  await expect(otherPage.locator('.sidebar__profile')).toContainText('Prueba E2E')
  await other.close()
})

test('a duplicate username shows the API reason inside the dialog', async ({ page }) => {
  await login(page, ADMIN)
  await openUsersTab(page)

  const dialog = await createUser(page, PLAIN.username, 'una-clave-larga-e2e')
  await expect(dialog.getByText(`El usuario '${PLAIN.username}' ya existe`)).toBeVisible()
})

test('deactivating a user ends their open session, refresh included', async ({ page, browser }) => {
  const username = uniqueName('e2e-baja')
  const password = 'una-clave-larga-e2e'

  await login(page, ADMIN)
  await openUsersTab(page)
  await createUser(page, username, password)
  await expect(page.getByRole('heading', { name: username, level: 2 })).toBeVisible()

  // The user is logged in elsewhere, with "keep me signed in".
  const theirs = await browser.newContext()
  const theirPage = await theirs.newPage()
  await login(theirPage, { username, password })

  await page.getByRole('button', { name: 'Desactivar usuario' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Desactivar usuario' }).click()
  await expect(page.getByText('Usuario desactivado correctamente.')).toBeVisible()

  // Their next load finds the session closed and the refresh cookie dead.
  await theirPage.reload()
  await expect(theirPage).toHaveURL(/\/login/)
  await theirs.close()
})
