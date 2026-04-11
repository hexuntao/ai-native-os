import type {
  AiFeedbackCreateInput,
  AiFeedbackListResponse,
  AiFeedbackUserAction,
  ListAiFeedbackInput,
} from '@ai-native-os/shared'
import { and, count, desc, eq, inArray, sql } from 'drizzle-orm'

import { type Database, db } from '../client'
import { aiAuditLogs, aiFeedback } from '../schema'

export interface AiFeedbackRecord {
  accepted: boolean
  actorAuthUserId: string
  actorRbacUserId: string | null
  auditLogId: string
  correction: string | null
  createdAt: Date
  feedbackText: string | null
  id: string
  userAction: AiFeedbackUserAction
}

export interface AiFeedbackListSummary {
  accepted: number
  edited: number
  humanOverrideCount: number
  overridden: number
  rejected: number
}

export class AiFeedbackAuditLogNotFoundError extends Error {
  constructor(auditLogId: string) {
    super(`AI audit log ${auditLogId} does not exist`)
    this.name = 'AiFeedbackAuditLogNotFoundError'
  }
}

function mapAiFeedbackRow(row: typeof aiFeedback.$inferSelect): AiFeedbackRecord {
  return {
    accepted: row.accepted,
    actorAuthUserId: row.actorAuthUserId,
    actorRbacUserId: row.actorRbacUserId,
    auditLogId: row.auditLogId,
    correction: row.correction,
    createdAt: row.createdAt,
    feedbackText: row.feedbackText,
    id: row.id,
    userAction: row.userAction as AiFeedbackUserAction,
  }
}

function normalizeNullableText(value: string | undefined): string | null {
  const normalizedValue = value?.trim()

  return normalizedValue ? normalizedValue : null
}

function resolveHumanOverride(input: AiFeedbackCreateInput): boolean {
  return !input.accepted || Boolean(normalizeNullableText(input.correction))
}

function createFeedbackSummary(rows: readonly AiFeedbackRecord[]): AiFeedbackListSummary {
  return rows.reduce<AiFeedbackListSummary>(
    (summary, row) => {
      if (row.userAction === 'accepted') {
        summary.accepted += 1
      }

      if (row.userAction === 'edited') {
        summary.edited += 1
      }

      if (row.userAction === 'overridden') {
        summary.overridden += 1
      }

      if (row.userAction === 'rejected') {
        summary.rejected += 1
      }

      if (!row.accepted || Boolean(row.correction)) {
        summary.humanOverrideCount += 1
      }

      return summary
    },
    {
      accepted: 0,
      edited: 0,
      humanOverrideCount: 0,
      overridden: 0,
      rejected: 0,
    },
  )
}

/**
 * 持久化 AI 反馈记录，并在需要时同步标记关联审计日志的人工 override 状态。
 */
export async function createAiFeedback(
  input: AiFeedbackCreateInput & {
    actorAuthUserId: string
    actorRbacUserId: string | null
  },
  database: Database = db,
): Promise<AiFeedbackRecord> {
  const [auditLog] = await database
    .select({
      id: aiAuditLogs.id,
    })
    .from(aiAuditLogs)
    .where(eq(aiAuditLogs.id, input.auditLogId))
    .limit(1)

  if (!auditLog) {
    throw new AiFeedbackAuditLogNotFoundError(input.auditLogId)
  }

  const correction = normalizeNullableText(input.correction)
  const feedbackText = normalizeNullableText(input.feedbackText)
  const [feedbackRecord] = await database
    .insert(aiFeedback)
    .values({
      accepted: input.accepted,
      actorAuthUserId: input.actorAuthUserId,
      actorRbacUserId: input.actorRbacUserId,
      auditLogId: input.auditLogId,
      correction,
      feedbackText,
      userAction: input.userAction,
    })
    .returning()

  if (!feedbackRecord) {
    throw new Error(`Failed to persist AI feedback for audit log ${input.auditLogId}`)
  }

  if (resolveHumanOverride(input)) {
    await database
      .update(aiAuditLogs)
      .set({
        humanOverride: true,
      })
      .where(eq(aiAuditLogs.id, input.auditLogId))
  }

  return mapAiFeedbackRow(feedbackRecord)
}

/**
 * 读取指定审计日志的反馈记录，便于反馈链路验证。
 */
export async function listAiFeedbackByAuditLogId(
  auditLogId: string,
  database: Database = db,
): Promise<AiFeedbackRecord[]> {
  const rows = await database
    .select()
    .from(aiFeedback)
    .where(eq(aiFeedback.auditLogId, auditLogId))
    .orderBy(desc(aiFeedback.createdAt))

  return rows.map(mapAiFeedbackRow)
}

/**
 * 按主键读取单条 AI 反馈记录，供治理详情页和 API 详情接口复用。
 */
export async function getAiFeedbackById(
  feedbackId: string,
  database: Database = db,
): Promise<AiFeedbackRecord | null> {
  const [row] = await database
    .select()
    .from(aiFeedback)
    .where(eq(aiFeedback.id, feedbackId))
    .limit(1)

  return row ? mapAiFeedbackRow(row) : null
}

/**
 * 读取分页 AI 反馈列表，并附带基础 override 统计。
 */
export async function listAiFeedback(
  input: ListAiFeedbackInput,
  database: Database = db,
): Promise<AiFeedbackListResponse> {
  const filters = []

  if (input.auditLogId) {
    filters.push(eq(aiFeedback.auditLogId, input.auditLogId))
  }

  if (input.userAction) {
    filters.push(eq(aiFeedback.userAction, input.userAction))
  }

  if (input.accepted !== undefined) {
    filters.push(eq(aiFeedback.accepted, input.accepted))
  }

  if (input.search) {
    filters.push(
      sql`(${aiFeedback.feedbackText} ilike ${`%${input.search}%`} or ${aiFeedback.correction} ilike ${`%${input.search}%`})`,
    )
  }

  const where = filters.length > 0 ? and(...filters) : undefined
  const totalRow = await database.select({ total: count() }).from(aiFeedback).where(where)
  const total = totalRow[0]?.total ?? 0
  const pageRows = await database
    .select()
    .from(aiFeedback)
    .where(where)
    .orderBy(desc(aiFeedback.createdAt))
    .limit(input.pageSize)
    .offset((input.page - 1) * input.pageSize)
  const records = pageRows.map(mapAiFeedbackRow)
  const matchingRows = await database
    .select()
    .from(aiFeedback)
    .where(where)
    .orderBy(desc(aiFeedback.createdAt))

  return {
    data: records.map((row) => ({
      accepted: row.accepted,
      actorAuthUserId: row.actorAuthUserId,
      actorRbacUserId: row.actorRbacUserId,
      auditLogId: row.auditLogId,
      correction: row.correction,
      createdAt: row.createdAt.toISOString(),
      feedbackText: row.feedbackText,
      id: row.id,
      userAction: row.userAction,
    })),
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
    },
    summary: createFeedbackSummary(matchingRows.map(mapAiFeedbackRow)),
  }
}

export interface AiAuditFeedbackAggregate {
  auditLogId: string
  feedbackCount: number
  latestFeedbackAt: string | null
  latestUserAction: AiFeedbackUserAction | null
}

/**
 * 针对一组审计日志读取反馈聚合，用于 AI audit 列表展示 override 状态。
 */
export async function getAiFeedbackAggregatesByAuditLogIds(
  auditLogIds: readonly string[],
  database: Database = db,
): Promise<Map<string, AiAuditFeedbackAggregate>> {
  if (auditLogIds.length === 0) {
    return new Map()
  }

  const rows = await database
    .select()
    .from(aiFeedback)
    .where(inArray(aiFeedback.auditLogId, [...auditLogIds]))
    .orderBy(desc(aiFeedback.createdAt))

  const aggregateMap = new Map<string, AiAuditFeedbackAggregate>()

  for (const row of rows) {
    const currentAggregate = aggregateMap.get(row.auditLogId)

    if (!currentAggregate) {
      aggregateMap.set(row.auditLogId, {
        auditLogId: row.auditLogId,
        feedbackCount: 1,
        latestFeedbackAt: row.createdAt.toISOString(),
        latestUserAction: row.userAction as AiFeedbackUserAction,
      })
      continue
    }

    aggregateMap.set(row.auditLogId, {
      ...currentAggregate,
      feedbackCount: currentAggregate.feedbackCount + 1,
    })
  }

  return aggregateMap
}
