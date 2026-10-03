export const PERMISSIONS = {
  IAM_GRANT_CREATE: 'iam.grant.create',
  IAM_GRANT_REVOKE: 'iam.grant.revoke',
  IAM_ROLE_MANAGE: 'iam.role.manage',
  IAM_USER_CREATE: 'iam.user.create',
  IAM_USER_UPDATE: 'iam.user.update',
  IAM_USER_DELETE: 'iam.user.delete',
  IAM_USER_MANAGE: 'iam.user.manage',
  IAM_USER_VIEW: 'iam.user.view',
} as const

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]
