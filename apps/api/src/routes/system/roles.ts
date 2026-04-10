import { db, rolePermissions, roles, userRoles } from '@ai-native-os/db'
import {
  type ListRolesInput,
  listRolesInputSchema,
  type RoleListResponse,
  roleListResponseSchema,
} from '@ai-native-os/shared'
import { and, count, desc, eq, ilike, inArray } from 'drizzle-orm'

import { requireAnyPermission } from '@/orpc/procedures'
import { createPagination } from '@/routes/lib/pagination'

/**
 * 提供角色管理列表接口，并附带用户数量和权限数量摘要。
 */
export async function listRoles(input: ListRolesInput): Promise<RoleListResponse> {
  const filters = []

  if (input.search) {
    filters.push(ilike(roles.name, `%${input.search}%`))
  }

  if (input.status !== undefined) {
    filters.push(eq(roles.status, input.status))
  }

  const where = filters.length > 0 ? and(...filters) : undefined
  const totalRow = await db.select({ total: count() }).from(roles).where(where)
  const total = totalRow[0]?.total ?? 0
  const pageRows = await db
    .select()
    .from(roles)
    .where(where)
    .orderBy(roles.sortOrder, desc(roles.createdAt))
    .limit(input.pageSize)
    .offset((input.page - 1) * input.pageSize)

  const roleIds = pageRows.map((row) => row.id)
  const assignedUsers =
    roleIds.length === 0
      ? []
      : await db
          .select({
            roleId: userRoles.roleId,
            userId: userRoles.userId,
          })
          .from(userRoles)
          .where(inArray(userRoles.roleId, roleIds))
  const assignedPermissions =
    roleIds.length === 0
      ? []
      : await db
          .select({
            permissionId: rolePermissions.permissionId,
            roleId: rolePermissions.roleId,
          })
          .from(rolePermissions)
          .where(inArray(rolePermissions.roleId, roleIds))

  const userCountByRoleId = new Map<string, number>()

  for (const row of assignedUsers) {
    userCountByRoleId.set(row.roleId, (userCountByRoleId.get(row.roleId) ?? 0) + 1)
  }

  const permissionCountByRoleId = new Map<string, number>()

  for (const row of assignedPermissions) {
    permissionCountByRoleId.set(row.roleId, (permissionCountByRoleId.get(row.roleId) ?? 0) + 1)
  }

  return {
    data: pageRows.map((row) => ({
      code: row.code,
      createdAt: row.createdAt.toISOString(),
      description: row.description,
      id: row.id,
      name: row.name,
      permissionCount: permissionCountByRoleId.get(row.id) ?? 0,
      sortOrder: row.sortOrder,
      status: row.status,
      updatedAt: row.updatedAt.toISOString(),
      userCount: userCountByRoleId.get(row.id) ?? 0,
    })),
    pagination: createPagination(input.page, input.pageSize, total),
  }
}

/**
 * 提供角色管理列表接口，并附带用户数量和权限数量摘要。
 */
export const rolesListProcedure = requireAnyPermission([
  { action: 'read', subject: 'Role' },
  { action: 'manage', subject: 'Role' },
])
  .route({
    method: 'GET',
    path: '/api/v1/system/roles',
    tags: ['System:Roles'],
    summary: '查询角色列表',
    description:
      '分页返回系统角色目录，并附带每个角色当前绑定的用户数量与权限数量，供角色管理界面直接展示。',
  })
  .input(listRolesInputSchema)
  .output(roleListResponseSchema)
  .handler(async ({ input }) => listRoles(input))
