import { currentPermissionsResponseSchema } from '@ai-native-os/shared'

import { protectedProcedure } from '@/orpc/procedures'

export const currentPermissionsProcedure = protectedProcedure
  .route({
    method: 'GET',
    path: '/api/v1/system/permissions/current',
    tags: ['System:Permissions'],
    summary: '读取当前主体权限规则',
    description: '返回当前登录主体的角色编码和归一化 RBAC 权限规则列表。',
  })
  .output(currentPermissionsResponseSchema)
  .handler(({ context }) => ({
    permissionRules: context.permissionRules,
    rbacUserId: context.rbacUserId,
    roleCodes: context.roleCodes,
    userId: context.userId,
  }))
