import { z } from 'zod'

import { requirePermission } from '@/orpc/procedures'

export const permissionAdminCheckProcedure = requirePermission('manage', 'Permission')
  .route({
    method: 'GET',
    path: '/api/v1/system/permission-admin-check',
    tags: ['System:RBAC'],
    summary: 'Check permission management access',
    description:
      'Returns success only when the authenticated principal can manage Permission resources.',
  })
  .output(
    z.object({
      allowed: z.literal(true),
      roleCodes: z.array(z.string()),
    }),
  )
  .handler(({ context }) => ({
    allowed: true,
    roleCodes: context.roleCodes,
  }))
