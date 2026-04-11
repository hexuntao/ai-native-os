import { withOpenApiSchemaDoc } from '@ai-native-os/shared'
import { z } from 'zod'

import { requirePermission } from '@/orpc/procedures'

const rbacSummaryResponseSchema = withOpenApiSchemaDoc(
  z.object({
    permissionRuleCount: withOpenApiSchemaDoc(z.number().int().nonnegative(), {
      title: 'RbacSummaryPermissionRuleCount',
      description: '当前主体归一化后权限规则数量。',
      examples: [18],
    }),
    rbacUserId: withOpenApiSchemaDoc(z.string().uuid().nullable(), {
      title: 'RbacSummaryUserId',
      description: '当前主体映射到的应用 RBAC 用户 UUID；未映射时为 `null`。',
      examples: ['8c8d0f66-c9db-4c4e-9d82-f1c70d6ef001'],
    }),
    roleCodes: withOpenApiSchemaDoc(z.array(z.string()), {
      title: 'RbacSummaryRoleCodes',
      description: '当前主体持有的角色编码列表。',
      examples: [['super_admin']],
    }),
  }),
  {
    title: 'RbacSummaryResponse',
    description: '当前认证主体的 RBAC 角色与权限规则统计摘要。',
    examples: [
      {
        permissionRuleCount: 18,
        rbacUserId: '8c8d0f66-c9db-4c4e-9d82-f1c70d6ef001',
        roleCodes: ['super_admin'],
      },
    ],
  },
)

export const rbacSummaryProcedure = requirePermission('read', 'Role')
  .route({
    method: 'GET',
    path: '/api/v1/system/rbac-summary',
    tags: ['System:RBAC'],
    summary: '读取当前 RBAC 摘要',
    description: '返回当前认证主体的角色编码和权限规则数量摘要。',
  })
  .output(rbacSummaryResponseSchema)
  .handler(({ context }) => ({
    permissionRuleCount: context.permissionRules.length,
    rbacUserId: context.rbacUserId,
    roleCodes: context.roleCodes,
  }))
