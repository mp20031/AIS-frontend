import { describe, expect, it } from 'vitest'
import { meService } from '@/services/meService'
import { securityService } from '@/services/securityService'
import { json, mockFetch } from './fetchMock'

/** The one call a service made: method, path + query, and parsed body. */
function onlyCall(fetchMock: ReturnType<typeof mockFetch>) {
  expect(fetchMock).toHaveBeenCalledTimes(1)
  const [input, init] = fetchMock.mock.calls[0]
  const url = new URL(String(input))
  return {
    method: init?.method ?? 'GET',
    path: url.pathname.replace(/^.*?(\/v1\/)/, '$1') + url.search,
    body: init?.body ? JSON.parse(String(init.body)) : undefined,
  }
}

describe('securityService', () => {
  it.each([
    ['listModules', '/v1/modules'],
    ['listRoles', '/v1/roles'],
    ['listSubjects', '/v1/subjects'],
    ['listOrgUnits', '/v1/org-units'],
  ] as const)('%s reads %s', async (method, path) => {
    const fetchMock = mockFetch({ [path]: () => json(200, [{ id: 'x' }]) })
    await expect(securityService[method]()).resolves.toEqual([{ id: 'x' }])
    expect(onlyCall(fetchMock)).toMatchObject({ method: 'GET', path })
  })

  it('createRole sends a null description when none is given', async () => {
    const fetchMock = mockFetch({ '/v1/roles': () => json(201, { id: 'r1' }) })
    await securityService.createRole('Auditor')
    expect(onlyCall(fetchMock)).toEqual({ method: 'POST', path: '/v1/roles', body: { name: 'Auditor', description: null } })
  })

  it('deleteRole', async () => {
    const fetchMock = mockFetch({ '/v1/roles/r1': () => json(204) })
    await securityService.deleteRole('r1')
    expect(onlyCall(fetchMock)).toMatchObject({ method: 'DELETE', path: '/v1/roles/r1' })
  })

  it('replaceRolePermissions sends the full list', async () => {
    const fetchMock = mockFetch({ '/v1/roles/r1/permissions': () => json(200, { id: 'r1' }) })
    await securityService.replaceRolePermissions('r1', ['iam.role.manage'])
    expect(onlyCall(fetchMock)).toEqual({
      method: 'PUT',
      path: '/v1/roles/r1/permissions',
      body: { permission_codes: ['iam.role.manage'] },
    })
  })

  it.each([
    [{}, '/v1/grants'],
    [{ roleId: 'r1' }, '/v1/grants?role_id=r1'],
    [{ subjectId: 's1' }, '/v1/grants?subject_id=s1'],
    [{ roleId: 'r1', subjectId: 's1' }, '/v1/grants?role_id=r1&subject_id=s1'],
  ])('listGrants(%o) asks for %s', async (params, path) => {
    const fetchMock = mockFetch({ '/v1/grants': () => json(200, []) })
    await securityService.listGrants(params)
    expect(onlyCall(fetchMock).path).toBe(path)
  })

  it('createGrant and revokeGrant', async () => {
    const grant = { subject_id: 's1', role_id: 'r1', org_unit_id: 'o1', inherit_down: true, effect: 'allow' as const }
    let fetchMock = mockFetch({ '/v1/grants': () => json(201, { id: 'g1' }) })
    await securityService.createGrant(grant)
    expect(onlyCall(fetchMock)).toEqual({ method: 'POST', path: '/v1/grants', body: grant })

    fetchMock = mockFetch({ '/v1/grants/g1': () => json(200, { id: 'g1' }) })
    await securityService.revokeGrant('g1')
    expect(onlyCall(fetchMock)).toMatchObject({ method: 'DELETE', path: '/v1/grants/g1' })
  })

  it('createSubject sends the password', async () => {
    const fetchMock = mockFetch({ '/v1/subjects': () => json(201, { id: 's1' }) })
    await securityService.createSubject({ username: 'diego', password: 'a-long-password' })
    expect(onlyCall(fetchMock).body).toEqual({ username: 'diego', password: 'a-long-password' })
  })

  it('updateSubject patches only what it is given', async () => {
    const fetchMock = mockFetch({ '/v1/subjects/s1': () => json(200, { id: 's1' }) })
    await securityService.updateSubject('s1', { active: false })
    expect(onlyCall(fetchMock)).toEqual({ method: 'PATCH', path: '/v1/subjects/s1', body: { active: false } })
  })

  it.each([
    ['createRole', () => securityService.createRole('x')],
    ['replaceRolePermissions', () => securityService.replaceRolePermissions('r1', [])],
    ['createGrant', () =>
      securityService.createGrant({ subject_id: 's', role_id: 'r', org_unit_id: 'o', inherit_down: false, effect: 'allow' })],
    ['createSubject', () => securityService.createSubject({ username: 'x', password: 'y' })],
    ['updateSubject', () => securityService.updateSubject('s1', {})],
  ])('%s refuses an empty answer', async (_name, call) => {
    mockFetch({ '*': () => json(204) })
    await expect(call()).rejects.toThrow('Respuesta invalida del servidor')
  })

  it('a list answered with 204 is an empty list', async () => {
    mockFetch({ '/v1/roles': () => json(204) })
    await expect(securityService.listRoles()).resolves.toEqual([])
  })
})

describe('meService', () => {
  it('myModules', async () => {
    const fetchMock = mockFetch({ '/v1/me/modules': () => json(200, [{ key: 'payroll' }]) })
    await expect(meService.myModules()).resolves.toEqual([{ key: 'payroll' }])
    expect(onlyCall(fetchMock).path).toBe('/v1/me/modules')
  })

  it('startHandoff asks for a code for that module', async () => {
    const answer = { redirect_url: 'http://payroll/callback?code=abc', expires_in: 30 }
    const fetchMock = mockFetch({ '/v1/auth/handoff': () => json(200, answer) })

    await expect(meService.startHandoff('payroll')).resolves.toEqual(answer)
    expect(onlyCall(fetchMock)).toEqual({ method: 'POST', path: '/v1/auth/handoff', body: { module_key: 'payroll' } })
  })

  it('startHandoff refuses an empty answer', async () => {
    mockFetch({ '/v1/auth/handoff': () => json(204) })
    await expect(meService.startHandoff('payroll')).rejects.toThrow('Respuesta invalida del servidor')
  })
})
