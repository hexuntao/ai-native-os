import type { Database } from '@ai-native-os/db'
import {
  createPermissionKey,
  db,
  defaultPermissions,
  listOperationLogsByModuleAndTargetId,
  permissions,
  rolePermissions,
  roles,
  userRoles,
  writeOperationLog,
} from '@ai-native-os/db'
import {
  type AppActions,
  type AppSubjects,
  type CreatePermissionInput,
  createPermissionInputSchema,
  type DeletePermissionInput,
  type DeletePermissionResult,
  deletePermissionInputSchema,
  deletePermissionResultSchema,
  type GetPermissionAuditByIdInput,
  type GetPermissionByIdInput,
  type GetPermissionImpactByIdInput,
  getPermissionAuditByIdInputSchema,
  getPermissionByIdInputSchema,
  getPermissionImpactByIdInputSchema,
  type ListPermissionsInput,
  listPermissionsInputSchema,
  type PermissionAuditTrail,
  type PermissionEntry,
  type PermissionImpact,
  type PermissionListResponse,
  permissionAuditTrailSchema,
  permissionEntrySchema,
  permissionImpactSchema,
  permissionListResponseSchema,
  type UpdatePermissionInput,
  updatePermissionInputSchema,
} from '@ai-native-os/shared'
import { ORPCError } from '@orpc/server'
import { and, count, desc, eq, ilike, inArray, ne, or } from 'drizzle-orm'

import { requireAnyPermission } from '@/orpc/procedures'
import { createPagination } from '@/routes/lib/pagination'

type DatabaseTransaction = Parameters<Parameters<Database['transaction']>[0]>[0]
type DatabaseExecutor = Database | DatabaseTransaction

interface PermissionMutationContext {
  actorRbacUserId: string | null
  requestId: string
}

interface PermissionRowProjection {
  action: AppActions
  conditions: Record<string, unknown> | null
  createdAt: Date
  description: string | null
  fields: string[] | null
  id: string
  inverted: boolean
  resource: AppSubjects
}

interface PermissionImpactRoleSummary {
  code: string
  id: string
  name: string
  status: boolean
  userCount: number
}

const permissionReadPermissions = [
  { action: 'read', subject: 'Permission' },
  { action: 'manage', subject: 'Permission' },
] as const

const permissionWritePermissions = [
  { action: 'manage', subject: 'Permission' },
  { action: 'manage', subject: 'all' },
] as const

const protectedSeedPermissionIds = new Set(defaultPermissions.map((permission) => permission.id))

/**
 * 规范化字段约束数组，避免空字符串和顺序差异造成重复规则判断失真。
 */
function normalizePermissionFields(fields: readonly string[] | null | undefined): string[] | null {
  if (!fields || fields.length === 0) {
    return null
  }

  const normalizedFields = [...new Set(fields.map((field) => field.trim()).filter(Boolean))].sort()

  return normalizedFields.length > 0 ? normalizedFields : null
}

/**
 * 深度排序 JSON 对象键顺序，确保条件表达式能够稳定序列化比较。
 */
function normalizeJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeJsonValue(item))
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, nestedValue]) => [key, normalizeJsonValue(nestedValue)]),
    )
  }

  return value
}

/**
 * 规范化条件对象；空对象会收敛为 `null`，避免生成语义等价的重复规则。
 */
function normalizePermissionConditions(
  conditions: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!conditions) {
    return null
  }

  const normalizedValue = normalizeJsonValue(conditions)

  if (
    normalizedValue &&
    typeof normalizedValue === 'object' &&
    Object.keys(normalizedValue as Record<string, unknown>).length === 0
  ) {
    return null
  }

  return normalizedValue as Record<string, unknown>
}

/**
 * 为权限规则生成稳定签名，供重复规则检测和语义变更判断复用。
 */
function buildPermissionSignature(input: {
  action: AppActions
  conditions: Record<string, unknown> | null
  fields: string[] | null
  inverted: boolean
  resource: AppSubjects
}): string {
  return JSON.stringify({
    action: input.action,
    conditions: normalizePermissionConditions(input.conditions),
    fields: normalizePermissionFields(input.fields),
    inverted: input.inverted,
    resource: input.resource,
  })
}

/**
 * 聚合权限被角色引用的数量，供列表、详情和删除保护共用。
 */
async function loadPermissionRoleCounts(
  permissionIds: readonly string[],
  database: DatabaseExecutor = db,
): Promise<Map<string, number>> {
  if (permissionIds.length === 0) {
    return new Map<string, number>()
  }

  const roleBindings = await database
    .select({
      permissionId: rolePermissions.permissionId,
      roleId: rolePermissions.roleId,
    })
    .from(rolePermissions)
    .where(inArray(rolePermissions.permissionId, [...permissionIds]))

  const roleCountByPermissionId = new Map<string, number>()

  for (const roleBinding of roleBindings) {
    roleCountByPermissionId.set(
      roleBinding.permissionId,
      (roleCountByPermissionId.get(roleBinding.permissionId) ?? 0) + 1,
    )
  }

  return roleCountByPermissionId
}

/**
 * 把权限行与角色引用数量拼装成稳定的 API 输出结构。
 */
async function mapPermissionRowsToEntries(
  rows: readonly PermissionRowProjection[],
  database: DatabaseExecutor = db,
): Promise<PermissionEntry[]> {
  const roleCountByPermissionId = await loadPermissionRoleCounts(
    rows.map((row) => row.id),
    database,
  )

  return rows.map((row) => ({
    action: row.action,
    conditions: normalizePermissionConditions(row.conditions),
    createdAt: row.createdAt.toISOString(),
    description: row.description,
    fields: normalizePermissionFields(row.fields),
    id: row.id,
    inverted: row.inverted,
    resource: row.resource,
    roleCount: roleCountByPermissionId.get(row.id) ?? 0,
  }))
}

/**
 * 按权限主键读取单条权限详情，供详情接口和写后回读复用。
 */
async function loadPermissionEntryById(
  permissionId: string,
  database: DatabaseExecutor = db,
): Promise<PermissionEntry | null> {
  const [row] = await database
    .select({
      action: permissions.action,
      conditions: permissions.conditions,
      createdAt: permissions.createdAt,
      description: permissions.description,
      fields: permissions.fields,
      id: permissions.id,
      inverted: permissions.inverted,
      resource: permissions.resource,
    })
    .from(permissions)
    .where(eq(permissions.id, permissionId))
    .limit(1)

  if (!row) {
    return null
  }

  const [entry] = await mapPermissionRowsToEntries(
    [
      {
        ...row,
        action: row.action as AppActions,
        resource: row.resource as AppSubjects,
      },
    ],
    database,
  )

  return entry ?? null
}

/**
 * 保护 seed 权限不被运行态修改，避免基线 RBAC 拓扑被管理界面直接漂移。
 */
function assertSeedPermissionBoundary(permissionId: string, operationLabel: string): void {
  if (protectedSeedPermissionIds.has(permissionId)) {
    throw new ORPCError('BAD_REQUEST', {
      message: `Seeded permission is read-only in ${operationLabel}`,
    })
  }
}

/**
 * 保留 `manage:all` 给系统超级管理员，防止自定义权限旁路升级为全局能力。
 */
function assertManageAllReservation(action: AppActions, resource: AppSubjects): void {
  if (action === 'manage' && resource === 'all') {
    throw new ORPCError('BAD_REQUEST', {
      message: 'Permission manage:all is reserved for the seeded super_admin role',
    })
  }
}

/**
 * 阻止写入完全重复的权限规则，避免列表、能力装载和审计结果出现重复噪音。
 */
async function assertPermissionSignatureUniqueness(
  signature: string,
  permissionIdToExclude?: string,
  database: DatabaseExecutor = db,
): Promise<void> {
  const candidateRows = await database
    .select({
      action: permissions.action,
      conditions: permissions.conditions,
      fields: permissions.fields,
      id: permissions.id,
      inverted: permissions.inverted,
      resource: permissions.resource,
    })
    .from(permissions)
    .where(permissionIdToExclude ? ne(permissions.id, permissionIdToExclude) : undefined)

  const duplicateRow = candidateRows.find((row) => {
    const candidateSignature = buildPermissionSignature({
      action: row.action as AppActions,
      conditions: row.conditions,
      fields: row.fields,
      inverted: row.inverted,
      resource: row.resource as AppSubjects,
    })

    return candidateSignature === signature
  })

  if (duplicateRow) {
    throw new ORPCError('BAD_REQUEST', {
      message: `Permission rule ${duplicateRow.action}:${duplicateRow.resource} already exists`,
    })
  }
}

/**
 * 计算权限当前被角色引用的数量，供删除和语义变更边界校验复用。
 */
async function loadAssignedRoleCount(
  permissionId: string,
  database: DatabaseExecutor = db,
): Promise<number> {
  const [row] = await database
    .select({
      total: count(),
    })
    .from(rolePermissions)
    .where(eq(rolePermissions.permissionId, permissionId))

  return row?.total ?? 0
}

/**
 * 读取权限当前影响到的角色与用户数量，用于变更前风险评估。
 */
async function loadPermissionImpactRoleSummaries(
  permissionId: string,
  database: DatabaseExecutor = db,
): Promise<{
  assignedRoles: PermissionImpactRoleSummary[]
  totalAssignedUsers: number
}> {
  const roleRows = await database
    .select({
      code: roles.code,
      id: roles.id,
      name: roles.name,
      status: roles.status,
    })
    .from(rolePermissions)
    .innerJoin(roles, eq(rolePermissions.roleId, roles.id))
    .where(eq(rolePermissions.permissionId, permissionId))

  if (roleRows.length === 0) {
    return {
      assignedRoles: [],
      totalAssignedUsers: 0,
    }
  }

  const userBindingRows = await database
    .select({
      roleId: userRoles.roleId,
      userId: userRoles.userId,
    })
    .from(userRoles)
    .where(
      inArray(
        userRoles.roleId,
        roleRows.map((roleRow) => roleRow.id),
      ),
    )

  const userIdsByRoleId = new Map<string, Set<string>>()
  const totalAffectedUserIds = new Set<string>()

  for (const userBindingRow of userBindingRows) {
    const roleUserIds = userIdsByRoleId.get(userBindingRow.roleId) ?? new Set<string>()

    roleUserIds.add(userBindingRow.userId)
    userIdsByRoleId.set(userBindingRow.roleId, roleUserIds)
    totalAffectedUserIds.add(userBindingRow.userId)
  }

  return {
    assignedRoles: roleRows
      .map((roleRow) => ({
        code: roleRow.code,
        id: roleRow.id,
        name: roleRow.name,
        status: roleRow.status,
        userCount: userIdsByRoleId.get(roleRow.id)?.size ?? 0,
      }))
      .sort((leftRole, rightRole) => leftRole.code.localeCompare(rightRole.code)),
    totalAssignedUsers: totalAffectedUserIds.size,
  }
}

/**
 * 已被角色引用的权限禁止直接改写规则语义，必须先解绑角色后再变更。
 */
async function assertPermissionSemanticMutationBoundary(
  currentEntry: PermissionEntry,
  nextInput: UpdatePermissionInput,
  database: DatabaseExecutor = db,
): Promise<void> {
  const assignedRoleCount = await loadAssignedRoleCount(currentEntry.id, database)

  if (assignedRoleCount === 0) {
    return
  }

  const currentSignature = buildPermissionSignature({
    action: currentEntry.action,
    conditions: currentEntry.conditions,
    fields: currentEntry.fields,
    inverted: currentEntry.inverted,
    resource: currentEntry.resource,
  })
  const nextSignature = buildPermissionSignature({
    action: nextInput.action,
    conditions: nextInput.conditions,
    fields: nextInput.fields,
    inverted: nextInput.inverted,
    resource: nextInput.resource,
  })

  if (currentSignature !== nextSignature) {
    throw new ORPCError('BAD_REQUEST', {
      message: 'Assigned roles must be removed before changing permission rule semantics',
    })
  }
}

/**
 * 分页返回权限规则列表，并附带当前角色引用数量摘要。
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
    .select({
      action: permissions.action,
      conditions: permissions.conditions,
      createdAt: permissions.createdAt,
      description: permissions.description,
      fields: permissions.fields,
      id: permissions.id,
      inverted: permissions.inverted,
      resource: permissions.resource,
    })
    .from(permissions)
    .where(where)
    .orderBy(desc(permissions.createdAt))
    .limit(input.pageSize)
    .offset((input.page - 1) * input.pageSize)

  return {
    data: await mapPermissionRowsToEntries(
      pageRows.map((row) => ({
        ...row,
        action: row.action as AppActions,
        resource: row.resource as AppSubjects,
      })),
    ),
    pagination: createPagination(input.page, input.pageSize, total),
  }
}

/**
 * 读取单个权限规则详情。
 */
export async function getPermissionById(input: GetPermissionByIdInput): Promise<PermissionEntry> {
  const entry = await loadPermissionEntryById(input.id)

  if (!entry) {
    throw new ORPCError('NOT_FOUND', {
      message: 'Permission not found',
    })
  }

  return entry
}

/**
 * 读取权限规则的角色与用户影响面摘要，供变更评估与运营审查复用。
 */
export async function getPermissionImpactById(
  input: GetPermissionImpactByIdInput,
): Promise<PermissionImpact> {
  const permissionEntry = await loadPermissionEntryById(input.id)

  if (!permissionEntry) {
    throw new ORPCError('NOT_FOUND', {
      message: 'Permission not found',
    })
  }

  const impactSnapshot = await loadPermissionImpactRoleSummaries(input.id)

  return {
    assignedRoles: impactSnapshot.assignedRoles,
    permission: permissionEntry,
    totalAssignedRoles: impactSnapshot.assignedRoles.length,
    totalAssignedUsers: impactSnapshot.totalAssignedUsers,
  }
}

/**
 * 读取权限规则的最近变更审计轨迹，便于排查是谁在何时改动了权限语义。
 */
export async function getPermissionAuditById(
  input: GetPermissionAuditByIdInput,
): Promise<PermissionAuditTrail> {
  const permissionEntry = await loadPermissionEntryById(input.id)

  if (!permissionEntry) {
    throw new ORPCError('NOT_FOUND', {
      message: 'Permission not found',
    })
  }

  const auditTrail = await listOperationLogsByModuleAndTargetId('system_permissions', input.id)

  return {
    auditTrail: auditTrail.map((auditLog) => ({
      action: auditLog.action,
      createdAt: auditLog.createdAt.toISOString(),
      detail: auditLog.detail,
      errorMessage: auditLog.errorMessage,
      id: auditLog.id,
      module: auditLog.module,
      operatorId: auditLog.operatorId,
      requestId: auditLog.requestInfo?.requestId ?? null,
      requestInfo: auditLog.requestInfo,
      status: auditLog.status,
      targetId: auditLog.targetId,
    })),
    permission: permissionEntry,
  }
}

/**
 * 创建自定义权限规则并记录操作日志。
 */
export async function createPermissionEntry(
  input: CreatePermissionInput,
  context: PermissionMutationContext,
): Promise<PermissionEntry> {
  assertManageAllReservation(input.action, input.resource)

  const normalizedFields = normalizePermissionFields(input.fields)
  const normalizedConditions = normalizePermissionConditions(input.conditions)
  const signature = buildPermissionSignature({
    action: input.action,
    conditions: normalizedConditions,
    fields: normalizedFields,
    inverted: input.inverted,
    resource: input.resource,
  })

  await assertPermissionSignatureUniqueness(signature)

  const [createdPermission] = await db
    .insert(permissions)
    .values({
      action: input.action,
      conditions: normalizedConditions,
      description: input.description,
      fields: normalizedFields,
      inverted: input.inverted,
      resource: input.resource,
    })
    .returning({
      id: permissions.id,
    })

  if (!createdPermission) {
    throw new Error('Failed to create permission')
  }

  const createdEntry = await loadPermissionEntryById(createdPermission.id)

  if (!createdEntry) {
    throw new Error('Failed to reload created permission')
  }

  await writeOperationLog({
    action: 'create_permission',
    detail: `Created permission ${createPermissionKey(createdEntry.action, createdEntry.resource)}.`,
    module: 'system_permissions',
    operatorId: context.actorRbacUserId,
    requestInfo: {
      inverted: createdEntry.inverted,
      requestId: context.requestId,
      roleCount: createdEntry.roleCount,
    },
    targetId: createdEntry.id,
  })

  return createdEntry
}

/**
 * 更新自定义权限规则；若权限已被角色引用，则仅允许更新说明文本。
 */
export async function updatePermissionEntry(
  input: UpdatePermissionInput,
  context: PermissionMutationContext,
): Promise<PermissionEntry> {
  const currentEntry = await loadPermissionEntryById(input.id)

  if (!currentEntry) {
    throw new ORPCError('NOT_FOUND', {
      message: 'Permission not found',
    })
  }

  assertSeedPermissionBoundary(currentEntry.id, 'update')
  assertManageAllReservation(input.action, input.resource)
  await assertPermissionSemanticMutationBoundary(currentEntry, input)

  const normalizedFields = normalizePermissionFields(input.fields)
  const normalizedConditions = normalizePermissionConditions(input.conditions)
  const signature = buildPermissionSignature({
    action: input.action,
    conditions: normalizedConditions,
    fields: normalizedFields,
    inverted: input.inverted,
    resource: input.resource,
  })

  await assertPermissionSignatureUniqueness(signature, currentEntry.id)

  await db
    .update(permissions)
    .set({
      action: input.action,
      conditions: normalizedConditions,
      description: input.description,
      fields: normalizedFields,
      inverted: input.inverted,
      resource: input.resource,
    })
    .where(eq(permissions.id, input.id))

  const updatedEntry = await loadPermissionEntryById(input.id)

  if (!updatedEntry) {
    throw new Error('Failed to reload updated permission')
  }

  await writeOperationLog({
    action: 'update_permission',
    detail: `Updated permission ${createPermissionKey(updatedEntry.action, updatedEntry.resource)}.`,
    module: 'system_permissions',
    operatorId: context.actorRbacUserId,
    requestInfo: {
      inverted: updatedEntry.inverted,
      requestId: context.requestId,
      roleCount: updatedEntry.roleCount,
    },
    targetId: updatedEntry.id,
  })

  return updatedEntry
}

/**
 * 删除未被任何角色引用的自定义权限规则。
 */
export async function deletePermissionEntry(
  input: DeletePermissionInput,
  context: PermissionMutationContext,
): Promise<DeletePermissionResult> {
  const currentEntry = await loadPermissionEntryById(input.id)

  if (!currentEntry) {
    throw new ORPCError('NOT_FOUND', {
      message: 'Permission not found',
    })
  }

  assertSeedPermissionBoundary(currentEntry.id, 'delete')

  if (currentEntry.roleCount > 0) {
    throw new ORPCError('BAD_REQUEST', {
      message: 'Assigned roles must be removed before deleting this permission',
    })
  }

  await db.delete(permissions).where(eq(permissions.id, input.id))

  await writeOperationLog({
    action: 'delete_permission',
    detail: `Deleted permission ${createPermissionKey(currentEntry.action, currentEntry.resource)}.`,
    module: 'system_permissions',
    operatorId: context.actorRbacUserId,
    requestInfo: {
      inverted: currentEntry.inverted,
      requestId: context.requestId,
      roleCount: currentEntry.roleCount,
    },
    targetId: currentEntry.id,
  })

  return {
    deleted: true,
    id: currentEntry.id,
  }
}

/**
 * 对外暴露权限列表读取 procedure。
 */
export const permissionsListProcedure = requireAnyPermission(permissionReadPermissions)
  .route({
    method: 'GET',
    path: '/api/v1/system/permissions',
    tags: ['System:Permissions'],
    summary: '查询权限规则列表',
    description:
      '分页返回权限规则目录，包含资源、动作、条件、字段约束、角色引用数量和是否为禁止规则等信息，供权限中心直接消费。',
  })
  .input(listPermissionsInputSchema)
  .output(permissionListResponseSchema)
  .handler(async ({ input }) => listPermissions(input))

/**
 * 对外暴露单权限详情 procedure。
 */
export const permissionsGetByIdProcedure = requireAnyPermission(permissionReadPermissions)
  .route({
    method: 'GET',
    path: '/api/v1/system/permissions/:id',
    tags: ['System:Permissions'],
    summary: '读取单个权限规则详情',
    description: '按权限 UUID 读取单个权限规则详情，并返回当前角色引用数量摘要。',
  })
  .input(getPermissionByIdInputSchema)
  .output(permissionEntrySchema)
  .handler(async ({ input }) => getPermissionById(input))

/**
 * 对外暴露权限影响面检查 procedure。
 */
export const permissionsImpactProcedure = requireAnyPermission(permissionReadPermissions)
  .route({
    method: 'GET',
    path: '/api/v1/system/permissions/:id/impact',
    tags: ['System:Permissions'],
    summary: '读取权限变更影响面',
    description: '返回当前权限规则影响到的角色与用户数量摘要，供权限语义变更前评估风险。',
  })
  .input(getPermissionImpactByIdInputSchema)
  .output(permissionImpactSchema)
  .handler(async ({ input }) => getPermissionImpactById(input))

/**
 * 对外暴露权限审计检查 procedure。
 */
export const permissionsAuditProcedure = requireAnyPermission(permissionReadPermissions)
  .route({
    method: 'GET',
    path: '/api/v1/system/permissions/:id/audit',
    tags: ['System:Permissions'],
    summary: '读取权限审计轨迹',
    description: '返回当前权限规则详情与最近变更操作日志轨迹，便于审查谁在何时修改了该权限。',
  })
  .input(getPermissionAuditByIdInputSchema)
  .output(permissionAuditTrailSchema)
  .handler(async ({ input }) => getPermissionAuditById(input))

/**
 * 对外暴露权限创建 procedure。
 */
export const permissionsCreateProcedure = requireAnyPermission(permissionWritePermissions)
  .route({
    method: 'POST',
    path: '/api/v1/system/permissions',
    tags: ['System:Permissions'],
    summary: '创建权限规则',
    description:
      '创建自定义权限规则；系统保留权限、`manage:all` 提升和完全重复的规则会在服务端被拒绝，并记录审计日志。',
  })
  .input(createPermissionInputSchema)
  .output(permissionEntrySchema)
  .handler(async ({ context, input }) =>
    createPermissionEntry(input, {
      actorRbacUserId: context.rbacUserId,
      requestId: context.requestId,
    }),
  )

/**
 * 对外暴露权限更新 procedure。
 */
export const permissionsUpdateProcedure = requireAnyPermission(permissionWritePermissions)
  .route({
    method: 'PUT',
    path: '/api/v1/system/permissions/:id',
    tags: ['System:Permissions'],
    summary: '更新权限规则',
    description:
      '更新自定义权限规则；若该权限已被角色引用，则只能修改说明文本，规则语义变更需先解绑角色后再操作。',
  })
  .input(updatePermissionInputSchema)
  .output(permissionEntrySchema)
  .handler(async ({ context, input }) =>
    updatePermissionEntry(input, {
      actorRbacUserId: context.rbacUserId,
      requestId: context.requestId,
    }),
  )

/**
 * 对外暴露权限删除 procedure。
 */
export const permissionsDeleteProcedure = requireAnyPermission(permissionWritePermissions)
  .route({
    method: 'DELETE',
    path: '/api/v1/system/permissions/:id',
    tags: ['System:Permissions'],
    summary: '删除权限规则',
    description:
      '删除一个未被任何角色引用的自定义权限规则；系统保留权限和仍被角色引用的权限会在服务端被拒绝删除，并记录审计日志。',
  })
  .input(deletePermissionInputSchema)
  .output(deletePermissionResultSchema)
  .handler(async ({ context, input }) =>
    deletePermissionEntry(input, {
      actorRbacUserId: context.rbacUserId,
      requestId: context.requestId,
    }),
  )
