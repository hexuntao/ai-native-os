import { randomUUID } from 'node:crypto'
import type { Database } from '@ai-native-os/db'
import {
  account as authAccounts,
  user as authUsers,
  db,
  hashCredentialPassword,
  roles,
  userRoles,
  users,
  writeOperationLog,
} from '@ai-native-os/db'
import {
  type AppAbility,
  type CreateUserInput,
  createUserInputSchema,
  type DeleteUserInput,
  type DeleteUserResult,
  deleteUserInputSchema,
  deleteUserResultSchema,
  type GetUserByIdInput,
  getUserByIdInputSchema,
  type ListUsersInput,
  listUsersInputSchema,
  type UpdateUserInput,
  type UserEntry,
  type UserListResponse,
  updateUserInputSchema,
  userEntrySchema,
  userListResponseSchema,
} from '@ai-native-os/shared'
import { ORPCError } from '@orpc/server'
import { and, count, desc, eq, ilike, inArray, ne, or } from 'drizzle-orm'
import { requireAnyPermission } from '@/orpc/procedures'
import { createPagination } from '@/routes/lib/pagination'

type DatabaseTransaction = Parameters<Parameters<Database['transaction']>[0]>[0]
type DatabaseExecutor = Database | DatabaseTransaction

interface UserMutationContext {
  ability: AppAbility
  actorAuthUserId: string
  actorRbacUserId: string | null
  requestId: string
}

interface UserRowProjection {
  authUserId: string | null
  createdAt: Date
  email: string
  id: string
  nickname: string | null
  status: boolean
  updatedAt: Date
  username: string
}

const userReadPermissions = [
  { action: 'read', subject: 'User' },
  { action: 'manage', subject: 'User' },
] as const

const userWritePermissions = [
  { action: 'manage', subject: 'User' },
  { action: 'manage', subject: 'all' },
] as const

const managedUserPasswordHashPlaceholder = 'managed-by-better-auth'

/**
 * 统一规范角色编码数组，避免重复值和无序输入让写路径出现不稳定结果。
 */
function normalizeRoleCodes(roleCodes: readonly string[]): string[] {
  return [...new Set(roleCodes.map((roleCode) => roleCode.trim()).filter(Boolean))].sort()
}

/**
 * 判断两个角色集合是否等价，用于阻止当前登录主体把自己降权。
 */
function haveSameRoleCodes(left: readonly string[], right: readonly string[]): boolean {
  const normalizedLeft = normalizeRoleCodes(left)
  const normalizedRight = normalizeRoleCodes(right)

  if (normalizedLeft.length !== normalizedRight.length) {
    return false
  }

  return normalizedLeft.every((roleCode, index) => roleCode === normalizedRight[index])
}

/**
 * 把用户行与其角色编码拼装成 API 对外暴露的稳定结构。
 */
async function mapUserRowsWithRoles(
  rows: readonly UserRowProjection[],
  database: DatabaseExecutor = db,
): Promise<UserEntry[]> {
  const userIds = rows.map((row) => row.id)
  const roleMappings =
    userIds.length === 0
      ? []
      : await database
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

  return rows.map((row) => ({
    createdAt: row.createdAt.toISOString(),
    email: row.email,
    id: row.id,
    nickname: row.nickname,
    roleCodes: normalizeRoleCodes(roleCodesByUserId.get(row.id) ?? []),
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
    username: row.username,
  }))
}

/**
 * 读取单个用户的完整快照，供详情和写后回读复用。
 */
async function loadUserEntryById(
  userId: string,
  database: DatabaseExecutor = db,
): Promise<UserEntry | null> {
  const [row] = await database
    .select({
      authUserId: users.authUserId,
      createdAt: users.createdAt,
      email: users.email,
      id: users.id,
      nickname: users.nickname,
      status: users.status,
      updatedAt: users.updatedAt,
      username: users.username,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!row) {
    return null
  }

  const [entry] = await mapUserRowsWithRoles([row], database)

  return entry ?? null
}

interface AppUserIdentityRecord {
  authUserId: string | null
  email: string
  id: string
}

/**
 * 读取应用用户与认证主体的绑定信息，供认证同步写路径复用。
 */
async function loadAppUserIdentityById(
  userId: string,
  database: DatabaseExecutor = db,
): Promise<AppUserIdentityRecord | null> {
  const [row] = await database
    .select({
      authUserId: users.authUserId,
      email: users.email,
      id: users.id,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  return row ?? null
}

/**
 * 按角色编码加载可分配角色，并确保所有角色都是激活态。
 */
async function loadAssignableRolesByCodes(
  roleCodes: readonly string[],
  database: DatabaseExecutor = db,
): Promise<Array<{ code: string; id: string }>> {
  const normalizedRoleCodes = normalizeRoleCodes(roleCodes)

  if (normalizedRoleCodes.length === 0) {
    return []
  }

  const roleRows = await database
    .select({
      code: roles.code,
      id: roles.id,
    })
    .from(roles)
    .where(and(inArray(roles.code, normalizedRoleCodes), eq(roles.status, true)))

  if (roleRows.length !== normalizedRoleCodes.length) {
    const knownRoleCodes = new Set(roleRows.map((roleRow) => roleRow.code))
    const missingRoleCodes = normalizedRoleCodes.filter((roleCode) => !knownRoleCodes.has(roleCode))

    throw new ORPCError('BAD_REQUEST', {
      message: `Unknown or inactive role codes: ${missingRoleCodes.join(', ')}`,
    })
  }

  return roleRows
}

/**
 * 非超级管理员不得创建、修改或删除 `super_admin` 角色主体。
 */
function assertSuperAdminBoundary(
  ability: AppAbility,
  roleCodes: readonly string[],
  operationLabel: string,
): void {
  if (roleCodes.includes('super_admin') && !ability.can('manage', 'all')) {
    throw new ORPCError('FORBIDDEN', {
      message: `Only super_admin can ${operationLabel} super_admin users`,
    })
  }
}

/**
 * 防止当前登录主体在用户管理页把自己删掉或降权，避免立即锁死当前会话。
 */
function assertSelfMutationBoundary(
  actorRbacUserId: string | null,
  currentEntry: UserEntry,
  nextStatus: boolean,
  nextRoleCodes: readonly string[],
): void {
  if (!actorRbacUserId || actorRbacUserId !== currentEntry.id) {
    return
  }

  if (!nextStatus) {
    throw new ORPCError('BAD_REQUEST', {
      message: 'Current RBAC user cannot disable itself from this screen',
    })
  }

  if (!haveSameRoleCodes(currentEntry.roleCodes, nextRoleCodes)) {
    throw new ORPCError('BAD_REQUEST', {
      message: 'Current RBAC user cannot change its own role bindings from this screen',
    })
  }
}

/**
 * 按 app user 主体解析关联的 Better Auth user，主路径走稳定 authUserId，旧数据仅保留 email 兜底。
 */
async function findAuthUserForAppUser(
  identity: AppUserIdentityRecord,
  database: DatabaseExecutor = db,
): Promise<{ email: string; id: string } | null> {
  const authRows = await database
    .select({
      email: authUsers.email,
      id: authUsers.id,
    })
    .from(authUsers)
    .where(
      identity.authUserId
        ? or(eq(authUsers.id, identity.authUserId), eq(authUsers.email, identity.email))
        : eq(authUsers.email, identity.email),
    )
    .limit(2)

  return (
    (identity.authUserId ? authRows.find((authRow) => authRow.id === identity.authUserId) : null) ??
    authRows.find((authRow) => authRow.email === identity.email) ??
    null
  )
}

/**
 * 保证邮箱和用户名在应用用户表中唯一，并阻止与现有 Better Auth 主体邮箱冲突。
 */
async function assertUserUniqueness(
  input: Pick<CreateUserInput, 'email' | 'username'>,
  database: DatabaseExecutor = db,
  currentUserId?: string,
  currentAuthUserId?: string,
): Promise<void> {
  const emailCondition = currentUserId
    ? and(eq(users.email, input.email), ne(users.id, currentUserId))
    : eq(users.email, input.email)
  const usernameCondition = currentUserId
    ? and(eq(users.username, input.username), ne(users.id, currentUserId))
    : eq(users.username, input.username)
  const [existingAppUser] = await database
    .select({
      email: users.email,
      id: users.id,
      username: users.username,
    })
    .from(users)
    .where(or(emailCondition, usernameCondition))
    .limit(1)

  if (existingAppUser) {
    if (existingAppUser.email === input.email) {
      throw new ORPCError('BAD_REQUEST', {
        message: 'User email already exists',
      })
    }

    throw new ORPCError('BAD_REQUEST', {
      message: 'Username already exists',
    })
  }

  const [existingAuthUser] = await database
    .select({
      email: authUsers.email,
      id: authUsers.id,
    })
    .from(authUsers)
    .where(eq(authUsers.email, input.email))
    .limit(1)

  if (existingAuthUser && existingAuthUser.id !== currentAuthUserId) {
    throw new ORPCError('BAD_REQUEST', {
      message: 'Auth email already exists',
    })
  }
}

/**
 * 为指定 Better Auth user upsert credential account，支持创建时初始化或更新时重置密码。
 */
async function upsertCredentialAccount(
  authUserId: string,
  password: string,
  database: DatabaseExecutor,
): Promise<void> {
  const hashedPassword = await hashCredentialPassword(password)
  const [existingCredentialAccount] = await database
    .select({
      id: authAccounts.id,
    })
    .from(authAccounts)
    .where(and(eq(authAccounts.userId, authUserId), eq(authAccounts.providerId, 'credential')))
    .limit(1)

  if (existingCredentialAccount) {
    await database
      .update(authAccounts)
      .set({
        accountId: authUserId,
        password: hashedPassword,
        updatedAt: new Date(),
      })
      .where(eq(authAccounts.id, existingCredentialAccount.id))

    return
  }

  await database.insert(authAccounts).values({
    accountId: authUserId,
    createdAt: new Date(),
    id: randomUUID(),
    password: hashedPassword,
    providerId: 'credential',
    updatedAt: new Date(),
    userId: authUserId,
  })
}

/**
 * 写入或替换用户角色绑定，保证最终角色集合与输入完全一致。
 */
async function replaceUserRoleMappings(
  userId: string,
  roleIds: readonly string[],
  database: DatabaseExecutor,
): Promise<void> {
  await database.delete(userRoles).where(eq(userRoles.userId, userId))

  if (roleIds.length === 0) {
    return
  }

  await database.insert(userRoles).values(
    roleIds.map((roleId) => ({
      roleId,
      userId,
    })),
  )
}

/**
 * 读取用户管理页所需的分页目录。
 */
export async function listUsers(input: ListUsersInput): Promise<UserListResponse> {
  const filters = []

  if (input.search) {
    filters.push(
      or(ilike(users.username, `%${input.search}%`), ilike(users.email, `%${input.search}%`)),
    )
  }

  if (input.status !== undefined) {
    filters.push(eq(users.status, input.status))
  }

  const where = filters.length > 0 ? and(...filters) : undefined
  const totalRow = await db.select({ total: count() }).from(users).where(where)
  const total = totalRow[0]?.total ?? 0
  const pageRows = await db
    .select({
      authUserId: users.authUserId,
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

  return {
    data: await mapUserRowsWithRoles(pageRows),
    pagination: createPagination(input.page, input.pageSize, total),
  }
}

/**
 * 读取单个用户详情。
 */
export async function getUserById(input: GetUserByIdInput): Promise<UserEntry> {
  const entry = await loadUserEntryById(input.id)

  if (!entry) {
    throw new ORPCError('NOT_FOUND', {
      message: 'User not found',
    })
  }

  return entry
}

/**
 * 创建应用用户、角色绑定与 Better Auth credential 主体，并记录操作日志。
 */
export async function createUserEntry(
  input: CreateUserInput,
  context: UserMutationContext,
): Promise<UserEntry> {
  const normalizedRoleCodes = normalizeRoleCodes(input.roleCodes)

  assertSuperAdminBoundary(context.ability, normalizedRoleCodes, 'create')

  const roleRows = await loadAssignableRolesByCodes(normalizedRoleCodes)
  await assertUserUniqueness(input)

  const createdEntry = await db.transaction(async (transaction) => {
    const [createdUser] = await transaction
      .insert(users)
      .values({
        authUserId: null,
        email: input.email,
        nickname: input.nickname,
        passwordHash: managedUserPasswordHashPlaceholder,
        status: input.status,
        updatedAt: new Date(),
        username: input.username,
      })
      .returning({
        id: users.id,
      })

    if (!createdUser) {
      throw new Error('Failed to create app user')
    }

    await replaceUserRoleMappings(
      createdUser.id,
      roleRows.map((roleRow) => roleRow.id),
      transaction,
    )

    await transaction.insert(authUsers).values({
      createdAt: new Date(),
      email: input.email,
      emailVerified: true,
      id: createdUser.id,
      name: input.nickname ?? input.username,
      updatedAt: new Date(),
    })

    await transaction
      .update(users)
      .set({
        authUserId: createdUser.id,
        updatedAt: new Date(),
      })
      .where(eq(users.id, createdUser.id))

    await upsertCredentialAccount(createdUser.id, input.password, transaction)

    return loadUserEntryById(createdUser.id, transaction)
  })

  if (!createdEntry) {
    throw new Error('Failed to reload created user')
  }

  await writeOperationLog({
    action: 'create_user',
    detail: `Created user ${createdEntry.username} with ${createdEntry.roleCodes.length} role bindings.`,
    module: 'system_users',
    operatorId: context.actorRbacUserId,
    requestInfo: {
      requestId: context.requestId,
      roleCodes: createdEntry.roleCodes.join(','),
      userEmail: createdEntry.email,
    },
    targetId: createdEntry.id,
  })

  return createdEntry
}

/**
 * 更新应用用户、角色绑定与 Better Auth 主体信息，并在需要时重置 credential 密码。
 */
export async function updateUserEntry(
  input: UpdateUserInput,
  context: UserMutationContext,
): Promise<UserEntry> {
  const currentEntry = await loadUserEntryById(input.id)

  if (!currentEntry) {
    throw new ORPCError('NOT_FOUND', {
      message: 'User not found',
    })
  }

  const normalizedRoleCodes = normalizeRoleCodes(input.roleCodes)
  const currentIdentity = await loadAppUserIdentityById(input.id)

  assertSuperAdminBoundary(context.ability, currentEntry.roleCodes, 'manage')
  assertSuperAdminBoundary(context.ability, normalizedRoleCodes, 'assign')
  assertSelfMutationBoundary(
    context.actorRbacUserId,
    currentEntry,
    input.status,
    normalizedRoleCodes,
  )

  if (!currentIdentity) {
    throw new ORPCError('NOT_FOUND', {
      message: 'User not found',
    })
  }

  const currentAuthUser = await findAuthUserForAppUser(currentIdentity)
  const roleRows = await loadAssignableRolesByCodes(normalizedRoleCodes)
  await assertUserUniqueness(input, db, currentEntry.id, currentAuthUser?.id)

  const updatedEntry = await db.transaction(async (transaction) => {
    await transaction
      .update(users)
      .set({
        authUserId: currentAuthUser?.id ?? currentIdentity.authUserId ?? null,
        email: input.email,
        nickname: input.nickname,
        status: input.status,
        updatedAt: new Date(),
        username: input.username,
      })
      .where(eq(users.id, input.id))

    await replaceUserRoleMappings(
      input.id,
      roleRows.map((roleRow) => roleRow.id),
      transaction,
    )

    if (currentAuthUser) {
      await transaction
        .update(authUsers)
        .set({
          email: input.email,
          name: input.nickname ?? input.username,
          updatedAt: new Date(),
        })
        .where(eq(authUsers.id, currentAuthUser.id))

      await transaction
        .update(users)
        .set({
          authUserId: currentAuthUser.id,
          updatedAt: new Date(),
        })
        .where(eq(users.id, input.id))

      if (input.password) {
        await upsertCredentialAccount(currentAuthUser.id, input.password, transaction)
      }
    } else if (input.password) {
      await transaction.insert(authUsers).values({
        createdAt: new Date(),
        email: input.email,
        emailVerified: true,
        id: input.id,
        name: input.nickname ?? input.username,
        updatedAt: new Date(),
      })

      await transaction
        .update(users)
        .set({
          authUserId: input.id,
          updatedAt: new Date(),
        })
        .where(eq(users.id, input.id))

      await upsertCredentialAccount(input.id, input.password, transaction)
    } else {
      throw new ORPCError('BAD_REQUEST', {
        message: 'Auth identity is missing; provide a password to recreate credential access',
      })
    }

    return loadUserEntryById(input.id, transaction)
  })

  if (!updatedEntry) {
    throw new Error('Failed to reload updated user')
  }

  await writeOperationLog({
    action: 'update_user',
    detail: `Updated user ${updatedEntry.username} and synchronized auth identity state.`,
    module: 'system_users',
    operatorId: context.actorRbacUserId,
    requestInfo: {
      requestId: context.requestId,
      roleCodes: updatedEntry.roleCodes.join(','),
      userEmail: updatedEntry.email,
    },
    targetId: updatedEntry.id,
  })

  return updatedEntry
}

/**
 * 删除应用用户与关联 Better Auth 主体，确保登录面和 RBAC 面不会留下孤儿记录。
 */
export async function deleteUserEntry(
  input: DeleteUserInput,
  context: UserMutationContext,
): Promise<DeleteUserResult> {
  const currentEntry = await loadUserEntryById(input.id)

  if (!currentEntry) {
    throw new ORPCError('NOT_FOUND', {
      message: 'User not found',
    })
  }

  if (context.actorRbacUserId === currentEntry.id) {
    throw new ORPCError('BAD_REQUEST', {
      message: 'Current RBAC user cannot delete itself from this screen',
    })
  }

  assertSuperAdminBoundary(context.ability, currentEntry.roleCodes, 'delete')
  const currentIdentity = await loadAppUserIdentityById(input.id)

  if (!currentIdentity) {
    throw new ORPCError('NOT_FOUND', {
      message: 'User not found',
    })
  }

  const currentAuthUser = await findAuthUserForAppUser(currentIdentity)

  await db.transaction(async (transaction) => {
    if (currentAuthUser) {
      await transaction.delete(authUsers).where(eq(authUsers.id, currentAuthUser.id))
    }

    await transaction.delete(users).where(eq(users.id, input.id))
  })

  await writeOperationLog({
    action: 'delete_user',
    detail: `Deleted user ${currentEntry.username} and detached all auth bindings.`,
    module: 'system_users',
    operatorId: context.actorRbacUserId,
    requestInfo: {
      requestId: context.requestId,
      userEmail: currentEntry.email,
    },
    targetId: currentEntry.id,
  })

  return {
    deleted: true,
    id: currentEntry.id,
  }
}

/**
 * 对外暴露用户列表读取 procedure。
 */
export const usersListProcedure = requireAnyPermission(userReadPermissions)
  .route({
    method: 'GET',
    path: '/api/v1/system/users',
    tags: ['System:Users'],
    summary: '分页查询后台用户目录',
    description:
      '按分页、关键词和启停状态查询后台用户目录，返回应用用户基础信息以及归一化后的 RBAC 角色编码。',
  })
  .input(listUsersInputSchema)
  .output(userListResponseSchema)
  .handler(async ({ input }) => listUsers(input))

/**
 * 对外暴露单用户详情 procedure。
 */
export const usersGetByIdProcedure = requireAnyPermission(userReadPermissions)
  .route({
    method: 'GET',
    path: '/api/v1/system/users/:id',
    tags: ['System:Users'],
    summary: '读取单个后台用户详情',
    description: '按用户 UUID 读取单个后台用户主体详情，并返回当前绑定的 RBAC 角色编码。',
  })
  .input(getUserByIdInputSchema)
  .output(userEntrySchema)
  .handler(async ({ input }) => getUserById(input))

/**
 * 对外暴露用户创建 procedure。
 */
export const usersCreateProcedure = requireAnyPermission(userWritePermissions)
  .route({
    method: 'POST',
    path: '/api/v1/system/users',
    tags: ['System:Users'],
    summary: '创建后台用户',
    description:
      '创建后台用户主体，并同步写入 Better Auth 凭证身份与 RBAC 角色绑定；该操作会记录审计日志。',
  })
  .input(createUserInputSchema)
  .output(userEntrySchema)
  .handler(async ({ context, input }) =>
    createUserEntry(input, {
      ability: context.ability,
      actorAuthUserId: context.userId ?? context.session?.user.id ?? 'unknown-user',
      actorRbacUserId: context.rbacUserId,
      requestId: context.requestId,
    }),
  )

/**
 * 对外暴露用户更新 procedure。
 */
export const usersUpdateProcedure = requireAnyPermission(userWritePermissions)
  .route({
    method: 'PUT',
    path: '/api/v1/system/users/:id',
    tags: ['System:Users'],
    summary: '更新后台用户',
    description:
      '更新后台用户主体、角色绑定与状态；如提供密码，还会同步重置 Better Auth credential 登录口令。',
  })
  .input(updateUserInputSchema)
  .output(userEntrySchema)
  .handler(async ({ context, input }) =>
    updateUserEntry(input, {
      ability: context.ability,
      actorAuthUserId: context.userId ?? context.session?.user.id ?? 'unknown-user',
      actorRbacUserId: context.rbacUserId,
      requestId: context.requestId,
    }),
  )

/**
 * 对外暴露用户删除 procedure。
 */
export const usersDeleteProcedure = requireAnyPermission(userWritePermissions)
  .route({
    method: 'DELETE',
    path: '/api/v1/system/users/:id',
    tags: ['System:Users'],
    summary: '删除后台用户',
    description: '删除后台用户主体，并在存在认证身份时一并删除 Better Auth 用户与关联凭证记录。',
  })
  .input(deleteUserInputSchema)
  .output(deleteUserResultSchema)
  .handler(async ({ context, input }) =>
    deleteUserEntry(input, {
      ability: context.ability,
      actorAuthUserId: context.userId ?? context.session?.user.id ?? 'unknown-user',
      actorRbacUserId: context.rbacUserId,
      requestId: context.requestId,
    }),
  )
