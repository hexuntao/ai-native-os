import { db, roles, session, user, userRoles, users } from '@ai-native-os/db'
import {
  type ListOnlineUsersInput,
  listOnlineUsersInputSchema,
  type OnlineUserListResponse,
  onlineUserListResponseSchema,
} from '@ai-native-os/shared'
import { and, desc, eq, gt, ilike, inArray, isNull, or } from 'drizzle-orm'

import { requireAnyPermission } from '@/orpc/procedures'
import { createPagination, paginateArray } from '@/routes/lib/pagination'

/**
 * 提供在线会话列表骨架。
 *
 * 当前使用 Better Auth `session` 表作为在线用户近似来源，
 * 后续若引入专门的 presence/heartbeat 模型，再替换为更精确的数据源。
 */
export async function listOnlineUsers(
  input: ListOnlineUsersInput,
): Promise<OnlineUserListResponse> {
  const where = input.search
    ? and(
        gt(session.expiresAt, new Date()),
        or(ilike(user.email, `%${input.search}%`), ilike(user.name, `%${input.search}%`)),
      )
    : gt(session.expiresAt, new Date())

  const rows = await db
    .select({
      createdAt: session.createdAt,
      email: user.email,
      expiresAt: session.expiresAt,
      ipAddress: session.ipAddress,
      name: user.name,
      sessionId: session.id,
      userAgent: session.userAgent,
      userId: user.id,
    })
    .from(session)
    .innerJoin(user, eq(session.userId, user.id))
    .where(where)
    .orderBy(desc(session.createdAt))

  const authUserIds = rows.map((row) => row.userId)
  const emails = rows.map((row) => row.email)
  const rbacUsers =
    authUserIds.length === 0 && emails.length === 0
      ? []
      : await db
          .select({
            authUserId: users.authUserId,
            email: users.email,
            rbacUserId: users.id,
            roleCode: roles.code,
          })
          .from(users)
          .leftJoin(userRoles, eq(userRoles.userId, users.id))
          .leftJoin(roles, eq(userRoles.roleId, roles.id))
          .where(
            or(
              authUserIds.length > 0 ? inArray(users.authUserId, authUserIds) : undefined,
              emails.length > 0
                ? and(isNull(users.authUserId), inArray(users.email, emails))
                : undefined,
            ),
          )

  const roleCodesByAuthUserId = new Map<string, string[]>()
  const roleCodesByEmail = new Map<string, string[]>()
  const rbacUserIdByAuthUserId = new Map<string, string>()
  const rbacUserIdByEmail = new Map<string, string>()

  for (const row of rbacUsers) {
    if (row.authUserId && row.rbacUserId) {
      rbacUserIdByAuthUserId.set(row.authUserId, row.rbacUserId)
    }

    if (row.rbacUserId) {
      rbacUserIdByEmail.set(row.email, row.rbacUserId)
    }

    if (row.roleCode) {
      if (row.authUserId) {
        const existingRoleCodes = roleCodesByAuthUserId.get(row.authUserId) ?? []
        existingRoleCodes.push(row.roleCode)
        roleCodesByAuthUserId.set(row.authUserId, existingRoleCodes)
      }

      const existingRoleCodes = roleCodesByEmail.get(row.email) ?? []
      existingRoleCodes.push(row.roleCode)
      roleCodesByEmail.set(row.email, existingRoleCodes)
    }
  }

  const total = rows.length
  const pagedRows = paginateArray(rows, input.page, input.pageSize)

  return {
    data: pagedRows.map((row) => ({
      createdAt: row.createdAt.toISOString(),
      email: row.email,
      expiresAt: row.expiresAt.toISOString(),
      ipAddress: row.ipAddress,
      name: row.name,
      rbacUserId:
        rbacUserIdByAuthUserId.get(row.userId) ?? rbacUserIdByEmail.get(row.email) ?? null,
      roleCodes: (
        roleCodesByAuthUserId.get(row.userId) ??
        roleCodesByEmail.get(row.email) ??
        []
      ).sort(),
      sessionId: row.sessionId,
      userAgent: row.userAgent,
      userId: row.userId,
    })),
    pagination: createPagination(input.page, input.pageSize, total),
  }
}

/**
 * 提供在线会话列表骨架。
 *
 * 当前使用 Better Auth `session` 表作为在线用户近似来源，
 * 后续若引入专门的 presence/heartbeat 模型，再替换为更精确的数据源。
 */
export const monitorOnlineListProcedure = requireAnyPermission([
  { action: 'read', subject: 'User' },
  { action: 'manage', subject: 'User' },
])
  .route({
    method: 'GET',
    path: '/api/v1/monitor/online',
    tags: ['Monitor:Online'],
    summary: '分页查询在线会话',
    description: '返回当前活跃 Better Auth 会话，并补充映射后的 RBAC 用户与角色信息。',
  })
  .input(listOnlineUsersInputSchema)
  .output(onlineUserListResponseSchema)
  .handler(async ({ input }) => listOnlineUsers(input))
