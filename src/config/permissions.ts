export const PERMISSIONS = {
  IAM_GRANT_CREATE: 'iam.grant.create',
  IAM_GRANT_REVOKE: 'iam.grant.revoke',
  IAM_ORG_UNIT_DELETE: 'iam.org_unit.delete',
  IAM_ORG_UNIT_MANAGE: 'iam.org_unit.manage',
  IAM_ROLE_MANAGE: 'iam.role.manage',
  IAM_USER_CREATE: 'iam.user.create',
  IAM_USER_UPDATE: 'iam.user.update',
  IAM_USER_DELETE: 'iam.user.delete',
  IAM_USER_MANAGE: 'iam.user.manage',
  IAM_USER_VIEW: 'iam.user.view',
} as const

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

// Any one of these opens /seguridad. Shared by the sidebar link and the route
// guard so the two cannot disagree; each maps to a tab in SecurityView.
export const SECURITY_ACCESS_PERMISSIONS: readonly PermissionCode[] = [
  PERMISSIONS.IAM_ROLE_MANAGE,
  PERMISSIONS.IAM_USER_VIEW,
  PERMISSIONS.IAM_ORG_UNIT_MANAGE,
]
