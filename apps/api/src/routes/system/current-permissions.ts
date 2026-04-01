import { currentPermissionsResponseSchema } from '@ai-native-os/shared'

import { protectedProcedure } from '@/orpc/procedures'

export const currentPermissionsProcedure = protectedProcedure
  .route({
    method: 'GET',
    path: '/api/v1/system/permissions/current',
    tags: ['System:Permissions'],
    summary: 'Get current RBAC permission rules',
    description:
      'Returns the current authenticated principal roles and normalized permission rules.',
  })
  .output(currentPermissionsResponseSchema)
  .handler(({ context }) => ({
    permissionRules: context.permissionRules,
    rbacUserId: context.rbacUserId,
    roleCodes: context.roleCodes,
    userId: context.userId,
  }))
