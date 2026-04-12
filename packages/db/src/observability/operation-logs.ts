import { and, desc, eq, sql } from 'drizzle-orm'

import { type Database, db } from '../client'
import { operationLogs } from '../schema'

export type OperationLogStatus = 'error' | 'success'
export type OperationLogFallbackActorKind = 'anonymous' | 'system'

export const anonymousOperationActorId = '00000000-0000-4000-8000-000000000001'
export const systemOperationActorId = '00000000-0000-4000-8000-000000000002'

export interface WriteOperationLogInput {
  action: string
  detail: string
  errorMessage?: string | null
  fallbackActorKind?: OperationLogFallbackActorKind
  module: string
  operatorId?: string | null
  requestInfo?: Record<string, boolean | number | string | null | undefined> | null
  status?: OperationLogStatus
  targetId?: string | null
}

export interface OperationLogRecord {
  action: string
  createdAt: Date
  detail: string
  errorMessage: string | null
  id: string
  module: string
  operatorId: string
  requestInfo: Record<string, string> | null
  status: OperationLogStatus
  targetId: string | null
}

function sanitizeRequestInfo(
  requestInfo: WriteOperationLogInput['requestInfo'],
): Record<string, string> | null {
  if (!requestInfo) {
    return null
  }

  const sanitizedEntries = Object.entries(requestInfo)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => [key, value === null ? 'null' : String(value)] as const)

  return sanitizedEntries.length > 0 ? Object.fromEntries(sanitizedEntries) : null
}

function resolveFallbackActorId(fallbackActorKind: OperationLogFallbackActorKind): string {
  return fallbackActorKind === 'system' ? systemOperationActorId : anonymousOperationActorId
}

function mapOperationLogRow(row: typeof operationLogs.$inferSelect): OperationLogRecord {
  return {
    action: row.action,
    createdAt: row.createdAt,
    detail: row.detail,
    errorMessage: row.errorMessage,
    id: row.id,
    module: row.module,
    operatorId: row.operatorId,
    requestInfo: row.requestInfo,
    status: row.status as OperationLogStatus,
    targetId: row.targetId,
  }
}

/**
 * 持久化一条标准化操作日志。
 *
 * 设计约束：
 * - 主业务不必为缺失 RBAC 主体而失败，会自动回退到匿名或系统主体
 * - requestInfo 统一收敛为字符串字典，便于后续筛选和导出
 */
export async function writeOperationLog(
  input: WriteOperationLogInput,
  database: Database = db,
): Promise<OperationLogRecord> {
  const [operationLog] = await database
    .insert(operationLogs)
    .values({
      action: input.action,
      detail: input.detail,
      errorMessage: input.errorMessage ?? null,
      module: input.module,
      operatorId:
        input.operatorId ?? resolveFallbackActorId(input.fallbackActorKind ?? 'anonymous'),
      requestInfo: sanitizeRequestInfo(input.requestInfo),
      status: input.status ?? 'success',
      targetId: input.targetId ?? null,
    })
    .returning()

  if (!operationLog) {
    throw new Error(`Failed to persist operation log for ${input.module}:${input.action}`)
  }

  return mapOperationLogRow(operationLog)
}

/**
 * 按请求 ID 读取操作日志，便于验证一次调用链是否完整落库。
 */
export async function listOperationLogsByRequestId(
  requestId: string,
  database: Database = db,
): Promise<OperationLogRecord[]> {
  const rows = await database
    .select()
    .from(operationLogs)
    .where(sql`${operationLogs.requestInfo}->>'requestId' = ${requestId}`)
    .orderBy(desc(operationLogs.createdAt))

  return rows.map(mapOperationLogRow)
}

/**
 * 按模块读取最近的操作日志，便于任务和模块级回归验证。
 */
export async function listOperationLogsByModule(
  module: string,
  database: Database = db,
): Promise<OperationLogRecord[]> {
  const rows = await database
    .select()
    .from(operationLogs)
    .where(eq(operationLogs.module, module))
    .orderBy(desc(operationLogs.createdAt))

  return rows.map(mapOperationLogRow)
}

/**
 * 按模块与目标资源主键读取最近的操作日志，供资源级治理审计合同复用。
 */
export async function listOperationLogsByModuleAndTargetId(
  module: string,
  targetId: string,
  database: Database = db,
): Promise<OperationLogRecord[]> {
  const rows = await database
    .select()
    .from(operationLogs)
    .where(and(eq(operationLogs.module, module), eq(operationLogs.targetId, targetId)))
    .orderBy(desc(operationLogs.createdAt))

  return rows.map(mapOperationLogRow)
}

/**
 * 按模块和 requestInfo 中的指定键值读取操作日志，供 key-scoped 治理审计合同复用。
 */
export async function listOperationLogsByModuleAndRequestInfoValue(
  module: string,
  requestInfoKey: string,
  requestInfoValue: string,
  options?: {
    status?: OperationLogStatus
  },
  database: Database = db,
): Promise<OperationLogRecord[]> {
  const conditions = [
    eq(operationLogs.module, module),
    sql`${operationLogs.requestInfo}->>${requestInfoKey} = ${requestInfoValue}`,
  ]

  if (options?.status) {
    conditions.push(eq(operationLogs.status, options.status))
  }

  const rows = await database
    .select()
    .from(operationLogs)
    .where(and(...conditions))
    .orderBy(desc(operationLogs.createdAt))

  return rows.map(mapOperationLogRow)
}
