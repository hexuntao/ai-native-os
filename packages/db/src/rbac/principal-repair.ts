import { and, eq, ilike, inArray, isNull, or } from 'drizzle-orm'

import { type Database, db } from '../client'
import { user as authUsers, roles, userRoles, users } from '../schema'

export interface PrincipalRepairCandidateRecord {
  authUserId: string
  email: string
  roleCodes: string[]
  userId: string
  username: string
}

export interface PrincipalRepairResultItem {
  authUserId: string | null
  email: string
  reason:
    | 'already_bound'
    | 'app_user_missing'
    | 'auth_user_already_bound'
    | 'auth_user_missing'
    | null
  status: 'repaired' | 'skipped'
  userId: string
  username: string
}

/**
 * 读取候选用户的角色编码快照，供修复预览与结果回显复用。
 */
async function loadRoleCodesByUserIds(
  userIds: readonly string[],
  database: Database = db,
): Promise<Map<string, string[]>> {
  if (userIds.length === 0) {
    return new Map<string, string[]>()
  }

  const roleRows = await database
    .select({
      roleCode: roles.code,
      userId: userRoles.userId,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(inArray(userRoles.userId, [...userIds]))

  const roleCodesByUserId = new Map<string, string[]>()

  for (const roleRow of roleRows) {
    const existingRoleCodes = roleCodesByUserId.get(roleRow.userId) ?? []

    existingRoleCodes.push(roleRow.roleCode)
    roleCodesByUserId.set(roleRow.userId, existingRoleCodes)
  }

  for (const [userId, roleCodes] of roleCodesByUserId.entries()) {
    roleCodesByUserId.set(userId, [...new Set(roleCodes)].sort())
  }

  return roleCodesByUserId
}

/**
 * 列出仍未绑定 auth_user_id，但可按同邮箱匹配 Better Auth 主体的应用用户。
 */
export async function listPrincipalRepairCandidates(
  search?: string,
  database: Database = db,
): Promise<PrincipalRepairCandidateRecord[]> {
  const where = search
    ? and(
        isNull(users.authUserId),
        or(ilike(users.email, `%${search}%`), ilike(users.username, `%${search}%`)),
      )
    : isNull(users.authUserId)
  const candidateRows = await database
    .select({
      authUserId: authUsers.id,
      email: users.email,
      userId: users.id,
      username: users.username,
    })
    .from(users)
    .innerJoin(authUsers, eq(authUsers.email, users.email))
    .where(where)

  const roleCodesByUserId = await loadRoleCodesByUserIds(
    candidateRows.map((candidateRow) => candidateRow.userId),
    database,
  )

  return candidateRows.map((candidateRow) => ({
    authUserId: candidateRow.authUserId,
    email: candidateRow.email,
    roleCodes: roleCodesByUserId.get(candidateRow.userId) ?? [],
    userId: candidateRow.userId,
    username: candidateRow.username,
  }))
}

/**
 * 显式修复指定应用用户的 auth_user_id 绑定，不在正常登录链路中隐式触发。
 */
export async function repairPrincipalBindings(
  userIds: readonly string[],
  database: Database = db,
): Promise<PrincipalRepairResultItem[]> {
  if (userIds.length === 0) {
    return []
  }

  return database.transaction(async (transaction) => {
    const appUserRows = await transaction
      .select({
        authUserId: users.authUserId,
        email: users.email,
        userId: users.id,
        username: users.username,
      })
      .from(users)
      .where(inArray(users.id, [...userIds]))

    const authRows = await transaction
      .select({
        authUserId: authUsers.id,
        email: authUsers.email,
      })
      .from(authUsers)
      .where(
        inArray(authUsers.email, [...new Set(appUserRows.map((appUserRow) => appUserRow.email))]),
      )

    const authUserIdByEmail = new Map(
      authRows.map((authRow) => [authRow.email, authRow.authUserId] as const),
    )
    const boundRows = await transaction
      .select({
        authUserId: users.authUserId,
        userId: users.id,
      })
      .from(users)
      .where(inArray(users.authUserId, [...new Set(authRows.map((authRow) => authRow.authUserId))]))

    const userIdByAuthUserId = new Map<string, string>()

    for (const boundRow of boundRows) {
      if (boundRow.authUserId) {
        userIdByAuthUserId.set(boundRow.authUserId, boundRow.userId)
      }
    }

    const resultItems: PrincipalRepairResultItem[] = []

    for (const userId of userIds) {
      const appUserRow = appUserRows.find((candidateRow) => candidateRow.userId === userId)

      if (!appUserRow) {
        resultItems.push({
          authUserId: null,
          email: '',
          reason: 'app_user_missing',
          status: 'skipped',
          userId,
          username: '',
        })
        continue
      }

      if (appUserRow.authUserId) {
        resultItems.push({
          authUserId: appUserRow.authUserId,
          email: appUserRow.email,
          reason: 'already_bound',
          status: 'skipped',
          userId: appUserRow.userId,
          username: appUserRow.username,
        })
        continue
      }

      const matchedAuthUserId = authUserIdByEmail.get(appUserRow.email)

      if (!matchedAuthUserId) {
        resultItems.push({
          authUserId: null,
          email: appUserRow.email,
          reason: 'auth_user_missing',
          status: 'skipped',
          userId: appUserRow.userId,
          username: appUserRow.username,
        })
        continue
      }

      const boundUserId = userIdByAuthUserId.get(matchedAuthUserId)

      if (boundUserId && boundUserId !== appUserRow.userId) {
        resultItems.push({
          authUserId: matchedAuthUserId,
          email: appUserRow.email,
          reason: 'auth_user_already_bound',
          status: 'skipped',
          userId: appUserRow.userId,
          username: appUserRow.username,
        })
        continue
      }

      await transaction
        .update(users)
        .set({
          authUserId: matchedAuthUserId,
          updatedAt: new Date(),
        })
        .where(eq(users.id, appUserRow.userId))

      userIdByAuthUserId.set(matchedAuthUserId, appUserRow.userId)
      resultItems.push({
        authUserId: matchedAuthUserId,
        email: appUserRow.email,
        reason: null,
        status: 'repaired',
        userId: appUserRow.userId,
        username: appUserRow.username,
      })
    }

    return resultItems
  })
}
