import { z } from 'zod'

import { requirePermission } from '@/orpc/procedures'

export const rbacSummaryProcedure = requirePermission('read', 'Role')
  .route({
    method: 'GET',
    path: '/api/v1/system/rbac-summary',
    tags: ['System:RBAC'],
    summary: 'Get current RBAC summary',
    description: 'Returns role and permission summary for the authenticated RBAC principal.',
  })
  .output(
    z.object({
      permissionRuleCount: z.number().int().nonnegative(),
      rbacUserId: z.string().uuid().nullable(),
      roleCodes: z.array(z.string()),
    }),
  )
  .handler(({ context }) => ({
    permissionRuleCount: context.permissionRules.length,
    rbacUserId: context.rbacUserId,
    roleCodes: context.roleCodes,
  }))
