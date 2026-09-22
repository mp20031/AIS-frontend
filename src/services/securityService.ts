import { apiRequest } from '@/services/httpClient'

export interface PermissionOut {
  id: string
  module_id: string
  module_key: string
  code: string
  resource: string
  action: string
  sensitive: boolean
  description: string | null
}

export interface ModuleWithPermissions {
  id: string
  key: string
  name: string
  description: string | null
  active: boolean
  permissions: PermissionOut[]
}

export interface RoleOut {
  id: string
  name: string
  description: string | null
  active: boolean
  permission_codes: string[]
  active_grant_count: number
}

export interface GrantOut {
  id: string
  subject_id: string
  subject_username: string
  role_id: string
  role_name: string
  org_unit_id: string
  org_unit_name: string
  inherit_down: boolean
  effect: 'allow' | 'deny'
  granted_at: string
  revoked_at: string | null
  granted_by: string | null
  notes: string | null
}

export interface SubjectOut {
  id: string
  username: string
  display_name: string | null
  email: string | null
  active: boolean
  active_grant_count: number
}

export interface OrgUnitOut {
  id: string
  parent_id: string | null
  code: string
  name: string
  type: string
  path: string | null
}

export interface GrantCreatePayload {
  subject_id: string
  role_id: string
  org_unit_id: string
  inherit_down: boolean
  effect: 'allow' | 'deny'
}

export const securityService = {
  async listModules(): Promise<ModuleWithPermissions[]> {
    return (await apiRequest<ModuleWithPermissions[]>('/v1/modules')) ?? []
  },

  async listRoles(): Promise<RoleOut[]> {
    return (await apiRequest<RoleOut[]>('/v1/roles')) ?? []
  },

  async createRole(name: string, description?: string): Promise<RoleOut> {
    const role = await apiRequest<RoleOut>('/v1/roles', {
      method: 'POST',
      body: JSON.stringify({ name, description: description ?? null }),
    })
    if (!role) throw new Error('Respuesta invalida del servidor')
    return role
  },

  async deleteRole(roleId: string): Promise<void> {
    await apiRequest<null>(`/v1/roles/${roleId}`, { method: 'DELETE' })
  },

  async replaceRolePermissions(roleId: string, permissionCodes: string[]): Promise<RoleOut> {
    const role = await apiRequest<RoleOut>(`/v1/roles/${roleId}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permission_codes: permissionCodes }),
    })
    if (!role) throw new Error('Respuesta invalida del servidor')
    return role
  },

  async listGrants(params: { roleId?: string; subjectId?: string } = {}): Promise<GrantOut[]> {
    const query = new URLSearchParams()
    if (params.roleId) query.set('role_id', params.roleId)
    if (params.subjectId) query.set('subject_id', params.subjectId)
    const qs = query.toString()
    return (await apiRequest<GrantOut[]>(`/v1/grants${qs ? `?${qs}` : ''}`)) ?? []
  },

  async createGrant(payload: GrantCreatePayload): Promise<GrantOut> {
    const grant = await apiRequest<GrantOut>('/v1/grants', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (!grant) throw new Error('Respuesta invalida del servidor')
    return grant
  },

  async revokeGrant(grantId: string): Promise<void> {
    await apiRequest<GrantOut>(`/v1/grants/${grantId}`, { method: 'DELETE' })
  },

  async listSubjects(): Promise<SubjectOut[]> {
    return (await apiRequest<SubjectOut[]>('/v1/subjects')) ?? []
  },

  async listOrgUnits(): Promise<OrgUnitOut[]> {
    return (await apiRequest<OrgUnitOut[]>('/v1/org-units')) ?? []
  },
}
