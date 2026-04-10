import { db, permissions } from '@ai-native-os/db'
import {
  type AppActions,
  type AppSubjects,
  type ListPermissionsInput,
  listPermissionsInputSchema,
  type PermissionListResponse,
  permissionListResponseSchema,
} from '@ai-native-os/shared'
import { and, count, desc, eq, ilike, or } from 'drizzle-orm'

import { requireAnyPermission } from '@/orpc/procedures'
import { createPagination } from '@/routes/lib/pagination'

/**
 * 提供权限管理中心的只读骨架列表接口。
 */
export async function listPermissions(
  input: ListPermissionsInput,
): Promise<PermissionListResponse> {
  const filters = []

  if (input.search) {
    filters.push(
      or(
        ilike(permissions.resource, `%${input.search}%`),
        ilike(permissions.action, `%${input.search}%`),
      ),
    )
  }

  if (input.resource) {
    filters.push(eq(permissions.resource, input.resource))
  }

  if (input.action) {
    filters.push(eq(permissions.action, input.action))
  }

  const where = filters.length > 0 ? and(...filters) : undefined
  const totalRow = await db.select({ total: count() }).from(permissions).where(where)
  const total = totalRow[0]?.total ?? 0
  const pageRows = await db
    .select()
    .from(permissions)
    .where(where)
    .orderBy(desc(permissions.createdAt))
    .limit(input.pageSize)
    .offset((input.page - 1) * input.pageSize)

  return {
    data: pageRows.map((row) => ({
      action: row.action as AppActions,
      conditions: row.conditions,
      createdAt: row.createdAt.toISOString(),
      description: row.description,
      fields: row.fields,
      id: row.id,
      inverted: row.inverted,
      resource: row.resource as AppSubjects,
    })),
    pagination: createPagination(input.page, input.pageSize, total),
  }
}

/**
 * 提供权限管理中心的只读骨架列表接口。
 */
export const permissionsListProcedure = requireAnyPermission([
  { action: 'read', subject: 'Permission' },
  { action: 'manage', subject: 'Permission' },
])
  .route({
    method: 'GET',
    path: '/api/v1/system/permissions',
    tags: ['System:Permissions'],
    summary: '查询权限规则列表',
    description:
      '分页返回权限规则目录，包含资源、动作、条件、字段约束和是否为禁止规则等信息，供权限中心直接消费。',
  })
  .input(listPermissionsInputSchema)
  .output(permissionListResponseSchema)
  .handler(async ({ input }) => listPermissions(input))
