import { db, roles, userRoles, users } from '@ai-native-os/db'
import {
  type ListUsersInput,
  listUsersInputSchema,
  type UserListResponse,
  userListResponseSchema,
} from '@ai-native-os/shared'
import { and, count, desc, eq, ilike, inArray } from 'drizzle-orm'

import { requireAnyPermission } from '@/orpc/procedures'
import { createPagination } from '@/routes/lib/pagination'

/**
 * 提供用户管理页所需的 contract-first 列表接口。
 */
export async function listUsers(input: ListUsersInput): Promise<UserListResponse> {
  const filters = []

  if (input.search) {
    filters.push(ilike(users.username, `%${input.search}%`))
  }

  if (input.status !== undefined) {
    filters.push(eq(users.status, input.status))
  }

  const where = filters.length > 0 ? and(...filters) : undefined
  const totalRow = await db.select({ total: count() }).from(users).where(where)
  const total = totalRow[0]?.total ?? 0
  const pageRows = await db
    .select({
      createdAt: users.createdAt,
      email: users.email,
      id: users.id,
      nickname: users.nickname,
      status: users.status,
      updatedAt: users.updatedAt,
      username: users.username,
    })
    .from(users)
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(input.pageSize)
    .offset((input.page - 1) * input.pageSize)

  const userIds = pageRows.map((row) => row.id)
  const roleMappings =
    userIds.length === 0
      ? []
      : await db
          .select({
            roleCode: roles.code,
            userId: userRoles.userId,
          })
          .from(userRoles)
          .innerJoin(roles, eq(userRoles.roleId, roles.id))
          .where(inArray(userRoles.userId, userIds))

  const roleCodesByUserId = new Map<string, string[]>()

  for (const mapping of roleMappings) {
    const existingRoleCodes = roleCodesByUserId.get(mapping.userId) ?? []
    existingRoleCodes.push(mapping.roleCode)
    roleCodesByUserId.set(mapping.userId, existingRoleCodes)
  }

  return {
    data: pageRows.map((row) => ({
      createdAt: row.createdAt.toISOString(),
      email: row.email,
      id: row.id,
      nickname: row.nickname,
      roleCodes: (roleCodesByUserId.get(row.id) ?? []).sort(),
      status: row.status,
      updatedAt: row.updatedAt.toISOString(),
      username: row.username,
    })),
    pagination: createPagination(input.page, input.pageSize, total),
  }
}

/**
 * 提供用户管理页所需的 contract-first 列表接口。
 */
export const usersListProcedure = requireAnyPermission([
  { action: 'read', subject: 'User' },
  { action: 'manage', subject: 'User' },
])
  .route({
    method: 'GET',
    path: '/api/v1/system/users',
    tags: ['System:Users'],
    summary: 'List system users',
    description: 'Returns paginated application users together with their mapped RBAC role codes.',
  })
  .input(listUsersInputSchema)
  .output(userListResponseSchema)
  .handler(async ({ input }) => listUsers(input))
