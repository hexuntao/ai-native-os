import type { AppActions, AppSubjects } from '@ai-native-os/shared'
import { desc, eq } from 'drizzle-orm'

import { type Database, db } from '../client'
import { aiAuditLogs } from '../schema'

export type AiAuditLogStatus = 'error' | 'forbidden' | 'success'

export interface WriteAiAuditLogInput {
  action: AppActions
  actorAuthUserId: string
  actorRbacUserId: string | null
  errorMessage?: string | null
  input?: unknown
  output?: unknown
  requestInfo?: Record<string, string> | null
  roleCodes: string[]
  status: AiAuditLogStatus
  subject: AppSubjects
  toolId: string
}

export interface AiAuditLogRecord {
  action: AppActions
  actorAuthUserId: string
  actorRbacUserId: string | null
  createdAt: Date
  errorMessage: string | null
  humanOverride: boolean
  id: string
  input: unknown
  output: unknown
  requestInfo: Record<string, string> | null
  roleCodes: string[]
  status: AiAuditLogStatus
  subject: AppSubjects
  toolId: string
}

function sanitizeJsonValue(value: unknown): unknown {
  if (value === undefined) {
    return null
  }

  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return String(value)
  }
}

function mapAuditLogRow(row: typeof aiAuditLogs.$inferSelect): AiAuditLogRecord {
  return {
    action: row.action as AppActions,
    actorAuthUserId: row.actorAuthUserId,
    actorRbacUserId: row.actorRbacUserId,
    createdAt: row.createdAt,
    errorMessage: row.errorMessage,
    humanOverride: row.humanOverride,
    id: row.id,
    input: row.input,
    output: row.output,
    requestInfo: row.requestInfo,
    roleCodes: row.roleCodes,
    status: row.status as AiAuditLogStatus,
    subject: row.subject as AppSubjects,
    toolId: row.toolId,
  }
}

export async function writeAiAuditLog(
  input: WriteAiAuditLogInput,
  database: Database = db,
): Promise<AiAuditLogRecord> {
  const [auditLog] = await database
    .insert(aiAuditLogs)
    .values({
      action: input.action,
      actorAuthUserId: input.actorAuthUserId,
      actorRbacUserId: input.actorRbacUserId,
      errorMessage: input.errorMessage ?? null,
      input: sanitizeJsonValue(input.input),
      output: sanitizeJsonValue(input.output),
      requestInfo: input.requestInfo ?? null,
      roleCodes: input.roleCodes,
      status: input.status,
      subject: input.subject,
      toolId: input.toolId,
    })
    .returning()

  if (!auditLog) {
    throw new Error(`Failed to persist AI audit log for tool ${input.toolId}`)
  }

  return mapAuditLogRow(auditLog)
}

export async function listRecentAiAuditLogs(
  limit = 20,
  database: Database = db,
): Promise<AiAuditLogRecord[]> {
  const rows = await database
    .select()
    .from(aiAuditLogs)
    .orderBy(desc(aiAuditLogs.createdAt))
    .limit(limit)

  return rows.map(mapAuditLogRow)
}

/**
 * 按主键读取单条 AI 审计日志，供治理详情页和 API 详情接口复用。
 */
export async function getAiAuditLogById(
  auditLogId: string,
  database: Database = db,
): Promise<AiAuditLogRecord | null> {
  const [row] = await database
    .select()
    .from(aiAuditLogs)
    .where(eq(aiAuditLogs.id, auditLogId))
    .limit(1)

  return row ? mapAuditLogRow(row) : null
}

export async function listAiAuditLogsByToolId(
  toolId: string,
  database: Database = db,
): Promise<AiAuditLogRecord[]> {
  const rows = await database
    .select()
    .from(aiAuditLogs)
    .where(eq(aiAuditLogs.toolId, toolId))
    .orderBy(desc(aiAuditLogs.createdAt))

  return rows.map(mapAuditLogRow)
}
