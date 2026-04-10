import type { Database } from '@ai-native-os/db'
import {
  db,
  defaultRoles,
  permissions,
  rolePermissions,
  roles,
  userRoles,
  writeOperationLog,
} from '@ai-native-os/db'
import {
  type CreateRoleInput,
  createRoleInputSchema,
  type DeleteRoleInput,
  type DeleteRoleResult,
  deleteRoleInputSchema,
  deleteRoleResultSchema,
  type GetRoleByIdInput,
  getRoleByIdInputSchema,
  type ListRolesInput,
  listRolesInputSchema,
  type RoleEntry,
  type RoleListResponse,
  roleEntrySchema,
  roleListResponseSchema,
  type UpdateRoleInput,
  updateRoleInputSchema,
} from '@ai-native-os/shared'
import { ORPCError } from '@orpc/server'
import { and, count, desc, eq, ilike, inArray, ne } from 'drizzle-orm'

import { requireAnyPermission } from '@/orpc/procedures'
import { createPagination } from '@/routes/lib/pagination'

type DatabaseTransaction = Parameters<Parameters<Database['transaction']>[0]>[0]
type DatabaseExecutor = Database | DatabaseTransaction

interface RoleMutationContext {
  actorRbacUserId: string | null
  requestId: string
}

interface RoleRowProjection {
  code: string
  createdAt: Date
  description: string | null
  id: string
  name: string
  sortOrder: number
  status: boolean
  updatedAt: Date
}

const roleReadPermissions = [
  { action: 'read', subject: 'Role' },
  { action: 'manage', subject: 'Role' },
] as const

const roleWritePermissions = [
  { action: 'manage', subject: 'Role' },
  { action: 'manage', subject: 'all' },
] as const

const protectedSystemRoleCodes = new Set(defaultRoles.map((role) => role.code))

/**
 * 规范化权限主键数组，避免重复值和空字符串让角色写路径产生不稳定结果。
 */
function normalizePermissionIds(permissionIds: readonly string[]): string[] {
  return [
    ...new Set(permissionIds.map((permissionId) => permissionId.trim()).filter(Boolean)),
  ].sort()
}

/**
 * 批量聚合角色的用户绑定数、权限绑定数和权限主键列表，供列表与详情接口复用。
 */
async function loadRoleRelationSnapshot(
  roleIds: readonly string[],
  database: DatabaseExecutor = db,
): Promise<{
  permissionCountByRoleId: Map<string, number>
  permissionIdsByRoleId: Map<string, string[]>
  userCountByRoleId: Map<string, number>
}> {
  if (roleIds.length === 0) {
    return {
      permissionCountByRoleId: new Map<string, number>(),
      permissionIdsByRoleId: new Map<string, string[]>(),
      userCountByRoleId: new Map<string, number>(),
    }
  }

  const [assignedUsers, assignedPermissions] = await Promise.all([
    database
      .select({
        roleId: userRoles.roleId,
        userId: userRoles.userId,
      })
      .from(userRoles)
      .where(inArray(userRoles.roleId, [...roleIds])),
    database
      .select({
        permissionId: rolePermissions.permissionId,
        roleId: rolePermissions.roleId,
      })
      .from(rolePermissions)
      .where(inArray(rolePermissions.roleId, [...roleIds])),
  ])

  const userCountByRoleId = new Map<string, number>()
  const permissionCountByRoleId = new Map<string, number>()
  const permissionIdsByRoleId = new Map<string, string[]>()

  for (const row of assignedUsers) {
    userCountByRoleId.set(row.roleId, (userCountByRoleId.get(row.roleId) ?? 0) + 1)
  }

  for (const row of assignedPermissions) {
    permissionCountByRoleId.set(row.roleId, (permissionCountByRoleId.get(row.roleId) ?? 0) + 1)
    const existingPermissionIds = permissionIdsByRoleId.get(row.roleId) ?? []

    existingPermissionIds.push(row.permissionId)
    permissionIdsByRoleId.set(row.roleId, existingPermissionIds)
  }

  for (const [roleId, permissionIds] of permissionIdsByRoleId.entries()) {
    permissionIdsByRoleId.set(roleId, normalizePermissionIds(permissionIds))
  }

  return {
    permissionCountByRoleId,
    permissionIdsByRoleId,
    userCountByRoleId,
  }
}

/**
 * 把角色行与聚合后的用户/权限绑定信息拼装成稳定的 API 输出结构。
 */
async function mapRoleRowsToEntries(
  rows: readonly RoleRowProjection[],
  database: DatabaseExecutor = db,
): Promise<RoleEntry[]> {
  const relationSnapshot = await loadRoleRelationSnapshot(
    rows.map((row) => row.id),
    database,
  )

  return rows.map((row) => ({
    code: row.code,
    createdAt: row.createdAt.toISOString(),
    description: row.description,
    id: row.id,
    name: row.name,
    permissionCount: relationSnapshot.permissionCountByRoleId.get(row.id) ?? 0,
    permissionIds: relationSnapshot.permissionIdsByRoleId.get(row.id) ?? [],
    sortOrder: row.sortOrder,
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
    userCount: relationSnapshot.userCountByRoleId.get(row.id) ?? 0,
  }))
}

/**
 * 按角色主键读取单角色详情，供详情接口和写后回读共用。
 */
async function loadRoleEntryById(
  roleId: string,
  database: DatabaseExecutor = db,
): Promise<RoleEntry | null> {
  const [row] = await database
    .select({
      code: roles.code,
      createdAt: roles.createdAt,
      description: roles.description,
      id: roles.id,
      name: roles.name,
      sortOrder: roles.sortOrder,
      status: roles.status,
      updatedAt: roles.updatedAt,
    })
    .from(roles)
    .where(eq(roles.id, roleId))
    .limit(1)

  if (!row) {
    return null
  }

  const [entry] = await mapRoleRowsToEntries([row], database)

  return entry ?? null
}

/**
 * 批量加载待绑定权限，并确保所有权限主键都真实存在。
 */
async function loadAssignablePermissionsByIds(
  permissionIds: readonly string[],
  database: DatabaseExecutor = db,
): Promise<Array<{ action: string; id: string; resource: string }>> {
  const normalizedPermissionIds = normalizePermissionIds(permissionIds)

  if (normalizedPermissionIds.length === 0) {
    return []
  }

  const permissionRows = await database
    .select({
      action: permissions.action,
      id: permissions.id,
      resource: permissions.resource,
    })
    .from(permissions)
    .where(inArray(permissions.id, normalizedPermissionIds))

  if (permissionRows.length !== normalizedPermissionIds.length) {
    const knownPermissionIds = new Set(permissionRows.map((permissionRow) => permissionRow.id))
    const missingPermissionIds = normalizedPermissionIds.filter(
      (permissionId) => !knownPermissionIds.has(permissionId),
    )

    throw new ORPCError('BAD_REQUEST', {
      message: `Unknown permission ids: ${missingPermissionIds.join(', ')}`,
    })
  }

  return permissionRows
}

/**
 * 禁止创建、更新或删除系统保留角色，避免 seed 基线与运行态 RBAC 拓扑发生漂移。
 */
function assertSystemRoleBoundary(roleCode: string, operationLabel: string): void {
  if (protectedSystemRoleCodes.has(roleCode)) {
    throw new ORPCError('BAD_REQUEST', {
      message: `Seeded system role ${roleCode} is read-only in ${operationLabel}`,
    })
  }
}

/**
 * 禁止将 `manage:all` 绑定给自定义角色，避免旁路创建等价于超级管理员的角色。
 */
function assertManageAllReservation(
  permissionRows: ReadonlyArray<{ action: string; resource: string }>,
): void {
  if (
    permissionRows.some(
      (permissionRow) => permissionRow.action === 'manage' && permissionRow.resource === 'all',
    )
  ) {
    throw new ORPCError('BAD_REQUEST', {
      message: 'Permission manage:all is reserved for the seeded super_admin role',
    })
  }
}

/**
 * 校验角色编码唯一性，避免重复编码破坏 RBAC 绑定的稳定主键语义。
 */
async function assertRoleCodeUniqueness(
  roleCode: string,
  roleIdToExclude?: string,
  database: DatabaseExecutor = db,
): Promise<void> {
  const [existingRole] = await database
    .select({
      id: roles.id,
    })
    .from(roles)
    .where(
      roleIdToExclude
        ? and(eq(roles.code, roleCode), ne(roles.id, roleIdToExclude))
        : eq(roles.code, roleCode),
    )
    .limit(1)

  if (existingRole) {
    throw new ORPCError('BAD_REQUEST', {
      message: `Role code ${roleCode} already exists`,
    })
  }
}

/**
 * 同步替换角色与权限的绑定关系，确保写接口保持幂等且无残留脏数据。
 */
async function replaceRolePermissionMappings(
  roleId: string,
  permissionIds: readonly string[],
  database: DatabaseExecutor = db,
): Promise<void> {
  await database.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId))

  if (permissionIds.length === 0) {
    return
  }

  await database.insert(rolePermissions).values(
    permissionIds.map((permissionId) => ({
      permissionId,
      roleId,
    })),
  )
}

/**
 * 读取角色当前绑定的用户数量，供删除/停用边界校验复用。
 */
async function loadAssignedUserCount(
  roleId: string,
  database: DatabaseExecutor = db,
): Promise<number> {
  const [row] = await database
    .select({
      total: count(),
    })
    .from(userRoles)
    .where(eq(userRoles.roleId, roleId))

  return row?.total ?? 0
}

/**
 * 角色停用前要求先解除所有用户绑定，避免通过状态切换静默回收在线主体权限。
 */
async function assertInactiveRoleHasNoAssignments(
  roleId: string,
  nextStatus: boolean,
  database: DatabaseExecutor = db,
): Promise<void> {
  if (nextStatus) {
    return
  }

  const assignedUserCount = await loadAssignedUserCount(roleId, database)

  if (assignedUserCount > 0) {
    throw new ORPCError('BAD_REQUEST', {
      message: 'Assigned users must be removed before deactivating this role',
    })
  }
}

/**
 * 分页返回角色列表，并附带用户数量、权限数量和权限主键列表。
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
    .select({
      code: roles.code,
      createdAt: roles.createdAt,
      description: roles.description,
      id: roles.id,
      name: roles.name,
      sortOrder: roles.sortOrder,
      status: roles.status,
      updatedAt: roles.updatedAt,
    })
    .from(roles)
    .where(where)
    .orderBy(roles.sortOrder, desc(roles.createdAt))
    .limit(input.pageSize)
    .offset((input.page - 1) * input.pageSize)

  return {
    data: await mapRoleRowsToEntries(pageRows),
    pagination: createPagination(input.page, input.pageSize, total),
  }
}

/**
 * 读取单个角色详情，并返回当前权限绑定主键列表用于编辑表单回填。
 */
export async function getRoleById(input: GetRoleByIdInput): Promise<RoleEntry> {
  const entry = await loadRoleEntryById(input.id)

  if (!entry) {
    throw new ORPCError('NOT_FOUND', {
      message: 'Role not found',
    })
  }

  return entry
}

/**
 * 创建自定义角色与权限绑定，并记录标准化操作日志。
 */
export async function createRoleEntry(
  input: CreateRoleInput,
  context: RoleMutationContext,
): Promise<RoleEntry> {
  assertSystemRoleBoundary(input.code, 'create')
  await assertRoleCodeUniqueness(input.code)

  const permissionRows = await loadAssignablePermissionsByIds(input.permissionIds)

  assertManageAllReservation(permissionRows)

  const createdEntry = await db.transaction(async (transaction) => {
    const [createdRole] = await transaction
      .insert(roles)
      .values({
        code: input.code,
        description: input.description,
        name: input.name,
        sortOrder: input.sortOrder,
        status: input.status,
        updatedAt: new Date(),
      })
      .returning({
        id: roles.id,
      })

    if (!createdRole) {
      throw new Error('Failed to create role')
    }

    await replaceRolePermissionMappings(
      createdRole.id,
      permissionRows.map((permissionRow) => permissionRow.id),
      transaction,
    )

    return loadRoleEntryById(createdRole.id, transaction)
  })

  if (!createdEntry) {
    throw new Error('Failed to reload created role')
  }

  await writeOperationLog({
    action: 'create_role',
    detail: `Created role ${createdEntry.code} with ${createdEntry.permissionIds.length} permission bindings.`,
    module: 'system_roles',
    operatorId: context.actorRbacUserId,
    requestInfo: {
      permissionCount: createdEntry.permissionIds.length,
      requestId: context.requestId,
      roleCode: createdEntry.code,
    },
    targetId: createdEntry.id,
  })

  return createdEntry
}

/**
 * 更新自定义角色基础信息与权限绑定，并阻止系统保留角色发生运行态漂移。
 */
export async function updateRoleEntry(
  input: UpdateRoleInput,
  context: RoleMutationContext,
): Promise<RoleEntry> {
  const currentEntry = await loadRoleEntryById(input.id)

  if (!currentEntry) {
    throw new ORPCError('NOT_FOUND', {
      message: 'Role not found',
    })
  }

  assertSystemRoleBoundary(currentEntry.code, 'update')
  assertSystemRoleBoundary(input.code, 'update')
  await assertRoleCodeUniqueness(input.code, currentEntry.id)

  const permissionRows = await loadAssignablePermissionsByIds(input.permissionIds)

  assertManageAllReservation(permissionRows)
  await assertInactiveRoleHasNoAssignments(currentEntry.id, input.status)

  const updatedEntry = await db.transaction(async (transaction) => {
    await transaction
      .update(roles)
      .set({
        code: input.code,
        description: input.description,
        name: input.name,
        sortOrder: input.sortOrder,
        status: input.status,
        updatedAt: new Date(),
      })
      .where(eq(roles.id, input.id))

    await replaceRolePermissionMappings(
      input.id,
      permissionRows.map((permissionRow) => permissionRow.id),
      transaction,
    )

    return loadRoleEntryById(input.id, transaction)
  })

  if (!updatedEntry) {
    throw new Error('Failed to reload updated role')
  }

  await writeOperationLog({
    action: 'update_role',
    detail: `Updated role ${updatedEntry.code} with ${updatedEntry.permissionIds.length} permission bindings.`,
    module: 'system_roles',
    operatorId: context.actorRbacUserId,
    requestInfo: {
      permissionCount: updatedEntry.permissionIds.length,
      requestId: context.requestId,
      roleCode: updatedEntry.code,
    },
    targetId: updatedEntry.id,
  })

  return updatedEntry
}

/**
 * 删除自定义角色；仅允许删除未被用户引用的角色，避免用户权限被隐式剥离。
 */
export async function deleteRoleEntry(
  input: DeleteRoleInput,
  context: RoleMutationContext,
): Promise<DeleteRoleResult> {
  const currentEntry = await loadRoleEntryById(input.id)

  if (!currentEntry) {
    throw new ORPCError('NOT_FOUND', {
      message: 'Role not found',
    })
  }

  assertSystemRoleBoundary(currentEntry.code, 'delete')

  const assignedUserCount = await loadAssignedUserCount(currentEntry.id)

  if (assignedUserCount > 0) {
    throw new ORPCError('BAD_REQUEST', {
      message: 'Assigned users must be removed before deleting this role',
    })
  }

  await db.delete(roles).where(eq(roles.id, input.id))

  await writeOperationLog({
    action: 'delete_role',
    detail: `Deleted role ${currentEntry.code}.`,
    module: 'system_roles',
    operatorId: context.actorRbacUserId,
    requestInfo: {
      requestId: context.requestId,
      roleCode: currentEntry.code,
    },
    targetId: currentEntry.id,
  })

  return {
    deleted: true,
    id: currentEntry.id,
  }
}

/**
 * 对外暴露角色列表读取 procedure。
 */
export const rolesListProcedure = requireAnyPermission(roleReadPermissions)
  .route({
    method: 'GET',
    path: '/api/v1/system/roles',
    tags: ['System:Roles'],
    summary: '查询角色列表',
    description:
      '分页返回系统角色目录，并附带每个角色当前绑定的用户数量、权限数量和权限主键列表，供角色管理界面直接展示与回填。',
  })
  .input(listRolesInputSchema)
  .output(roleListResponseSchema)
  .handler(async ({ input }) => listRoles(input))

/**
 * 对外暴露单角色详情 procedure。
 */
export const rolesGetByIdProcedure = requireAnyPermission(roleReadPermissions)
  .route({
    method: 'GET',
    path: '/api/v1/system/roles/:id',
    tags: ['System:Roles'],
    summary: '读取单个角色详情',
    description: '按角色 UUID 读取单个角色详情，并返回当前绑定的权限主键列表与管理摘要。',
  })
  .input(getRoleByIdInputSchema)
  .output(roleEntrySchema)
  .handler(async ({ input }) => getRoleById(input))

/**
 * 对外暴露角色创建 procedure。
 */
export const rolesCreateProcedure = requireAnyPermission(roleWritePermissions)
  .route({
    method: 'POST',
    path: '/api/v1/system/roles',
    tags: ['System:Roles'],
    summary: '创建角色',
    description:
      '创建自定义 RBAC 角色并同步绑定权限规则；系统保留角色编码与 `manage:all` 权限会在服务端被拒绝，且该操作会记录审计日志。',
  })
  .input(createRoleInputSchema)
  .output(roleEntrySchema)
  .handler(async ({ context, input }) =>
    createRoleEntry(input, {
      actorRbacUserId: context.rbacUserId,
      requestId: context.requestId,
    }),
  )

/**
 * 对外暴露角色更新 procedure。
 */
export const rolesUpdateProcedure = requireAnyPermission(roleWritePermissions)
  .route({
    method: 'PUT',
    path: '/api/v1/system/roles/:id',
    tags: ['System:Roles'],
    summary: '更新角色',
    description:
      '更新自定义角色的名称、编码、启停状态、排序与权限绑定；系统保留角色、在用角色的危险停用和保留权限提升会在服务端被拒绝。',
  })
  .input(updateRoleInputSchema)
  .output(roleEntrySchema)
  .handler(async ({ context, input }) =>
    updateRoleEntry(input, {
      actorRbacUserId: context.rbacUserId,
      requestId: context.requestId,
    }),
  )

/**
 * 对外暴露角色删除 procedure。
 */
export const rolesDeleteProcedure = requireAnyPermission(roleWritePermissions)
  .route({
    method: 'DELETE',
    path: '/api/v1/system/roles/:id',
    tags: ['System:Roles'],
    summary: '删除角色',
    description:
      '删除一个未被任何用户绑定的自定义角色；系统保留角色与仍被用户引用的角色会在服务端被拒绝删除，并记录审计日志。',
  })
  .input(deleteRoleInputSchema)
  .output(deleteRoleResultSchema)
  .handler(async ({ context, input }) =>
    deleteRoleEntry(input, {
      actorRbacUserId: context.rbacUserId,
      requestId: context.requestId,
    }),
  )
