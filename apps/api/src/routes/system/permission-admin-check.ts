import { withOpenApiSchemaDoc } from '@ai-native-os/shared'
import { z } from 'zod'

import { requirePermission } from '@/orpc/procedures'

const permissionAdminCheckResponseSchema = withOpenApiSchemaDoc(
  z.object({
    allowed: withOpenApiSchemaDoc(z.literal(true), {
      title: 'PermissionAdminCheckAllowed',
      description: '当前主体已通过权限中心管理校验，固定为 `true`。',
      examples: [true],
    }),
    roleCodes: withOpenApiSchemaDoc(z.array(z.string()), {
      title: 'PermissionAdminCheckRoleCodes',
      description: '当前主体持有的角色编码列表。',
      examples: [['super_admin']],
    }),
  }),
  {
    title: 'PermissionAdminCheckResponse',
    description: '权限管理访问校验响应。',
    examples: [
      {
        allowed: true,
        roleCodes: ['super_admin'],
      },
    ],
  },
)

export const permissionAdminCheckProcedure = requirePermission('manage', 'Permission')
  .route({
    method: 'GET',
    path: '/api/v1/system/permission-admin-check',
    tags: ['System:RBAC'],
    summary: '校验权限管理访问资格',
    description: '仅当当前主体具备权限规则管理能力时返回成功，用于后台权限中心前置校验。',
  })
  .output(permissionAdminCheckResponseSchema)
  .handler(({ context }) => ({
    allowed: true,
    roleCodes: context.roleCodes,
  }))
