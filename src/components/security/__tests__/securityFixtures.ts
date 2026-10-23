import { env } from '@/config/env'
import { useSession } from '@/composables/useSession'
import type { GrantOut, OrgUnitOut, RoleOut, SubjectOut } from '@/services/securityService'
import { json, mockFetch } from '@/services/__tests__/fetchMock'

export const ALL_IAM = [
  'iam.role.manage',
  'iam.user.view',
  'iam.user.create',
  'iam.user.update',
  'iam.grant.create',
  'iam.grant.revoke',
]

/** Sign in, as far as the UI is concerned: a token and a loaded userinfo. */
export async function signInAs(permissions: string[], username = 'jperez') {
  sessionStorage.setItem(env.tokenKey, 'token')
  mockFetch({
    '/v1/auth/userinfo': () =>
      json(200, {
        id: `id-${username}`,
        username,
        display_name: null,
        email: null,
        active: true,
        roles: [],
        permissions,
      }),
  })
  await useSession().load(true)
}

export const subject = (username: string, overrides: Partial<SubjectOut> = {}): SubjectOut => ({
  id: `id-${username}`,
  username,
  display_name: null,
  email: null,
  active: true,
  active_grant_count: 0,
  ...overrides,
})

export const role = (name: string, codes: string[] = [], overrides: Partial<RoleOut> = {}): RoleOut => ({
  id: `role-${name}`,
  name,
  description: null,
  active: true,
  permission_codes: codes,
  active_grant_count: 0,
  ...overrides,
})

export const orgUnit = (code: string, path: string): OrgUnitOut => ({
  id: `ou-${code}`,
  parent_id: null,
  code,
  name: code.toUpperCase(),
  type: 'division',
  path,
})

export const grant = (id: string, roleName: string, overrides: Partial<GrantOut> = {}): GrantOut => ({
  id,
  subject_id: 'id-user-88',
  subject_username: 'user-88',
  role_id: `role-${roleName}`,
  role_name: roleName,
  org_unit_id: 'ou-div1',
  org_unit_name: 'DIV1',
  inherit_down: false,
  effect: 'allow',
  granted_at: '2026-10-01T00:00:00Z',
  revoked_at: null,
  granted_by: null,
  notes: null,
  ...overrides,
})
