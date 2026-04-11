import {
  aiAuditLogs,
  db,
  getAiAuditLogById,
  getAiFeedbackAggregatesByAuditLogIds,
  listAiFeedbackByAuditLogId,
} from '@ai-native-os/db'
import {
  type AiAuditDetail,
  type AiAuditListResponse,
  type AppActions,
  type AppSubjects,
  aiAuditDetailSchema,
  aiAuditListResponseSchema,
  type GetAiAuditLogByIdInput,
  getAiAuditLogByIdInputSchema,
  type ListAiAuditLogsInput,
  listAiAuditLogsInputSchema,
} from '@ai-native-os/shared'
import { ORPCError } from '@orpc/server'
import { and, count, desc, eq } from 'drizzle-orm'

import { requireAnyPermission } from '@/orpc/procedures'
import { createPagination } from '@/routes/lib/pagination'

/**
 * 提供文档路径约定下的 AI 审计日志分页接口。
 */
export async function listAiAuditLogs(input: ListAiAuditLogsInput): Promise<AiAuditListResponse> {
  const filters = []

  if (input.toolId) {
    filters.push(eq(aiAuditLogs.toolId, input.toolId))
  }

  if (input.status) {
    filters.push(eq(aiAuditLogs.status, input.status))
  }

  const where = filters.length > 0 ? and(...filters) : undefined
  const totalRow = await db.select({ total: count() }).from(aiAuditLogs).where(where)
  const total = totalRow[0]?.total ?? 0
  const pageRows = await db
    .select()
    .from(aiAuditLogs)
    .where(where)
    .orderBy(desc(aiAuditLogs.createdAt))
    .limit(input.pageSize)
    .offset((input.page - 1) * input.pageSize)
  const feedbackAggregates = await getAiFeedbackAggregatesByAuditLogIds(
    pageRows.map((row) => row.id),
  )

  return {
    data: pageRows.map((row) => ({
      ...(feedbackAggregates.get(row.id) ?? {
        feedbackCount: 0,
        latestFeedbackAt: null,
        latestUserAction: null,
      }),
      action: row.action as AppActions,
      actorAuthUserId: row.actorAuthUserId,
      actorRbacUserId: row.actorRbacUserId,
      createdAt: row.createdAt.toISOString(),
      errorMessage: row.errorMessage,
      humanOverride: row.humanOverride,
      id: row.id,
      requestId: row.requestInfo?.requestId ?? null,
      roleCodes: row.roleCodes,
      status: row.status as 'error' | 'forbidden' | 'success',
      subject: row.subject as AppSubjects,
      toolId: row.toolId,
    })),
    pagination: createPagination(input.page, input.pageSize, total),
  }
}

/**
 * 读取单条 AI 审计日志详情，补充其反馈链路与请求上下文。
 */
export async function getAiAuditLogDetail(input: GetAiAuditLogByIdInput): Promise<AiAuditDetail> {
  const auditLogRecord = await getAiAuditLogById(input.id)

  if (!auditLogRecord) {
    throw new ORPCError('NOT_FOUND', {
      message: 'AI audit log not found',
    })
  }

  const feedbackRecords = await listAiFeedbackByAuditLogId(input.id)

  return {
    action: auditLogRecord.action,
    actorAuthUserId: auditLogRecord.actorAuthUserId,
    actorRbacUserId: auditLogRecord.actorRbacUserId,
    createdAt: auditLogRecord.createdAt.toISOString(),
    errorMessage: auditLogRecord.errorMessage,
    feedback: feedbackRecords.map((feedbackRecord) => ({
      accepted: feedbackRecord.accepted,
      actorAuthUserId: feedbackRecord.actorAuthUserId,
      actorRbacUserId: feedbackRecord.actorRbacUserId,
      auditLogId: feedbackRecord.auditLogId,
      correction: feedbackRecord.correction,
      createdAt: feedbackRecord.createdAt.toISOString(),
      feedbackText: feedbackRecord.feedbackText,
      id: feedbackRecord.id,
      userAction: feedbackRecord.userAction,
    })),
    feedbackCount: feedbackRecords.length,
    humanOverride: auditLogRecord.humanOverride,
    id: auditLogRecord.id,
    latestFeedbackAt: feedbackRecords[0]?.createdAt.toISOString() ?? null,
    latestUserAction: feedbackRecords[0]?.userAction ?? null,
    requestId: auditLogRecord.requestInfo?.requestId ?? null,
    requestInfo: auditLogRecord.requestInfo,
    roleCodes: auditLogRecord.roleCodes,
    status: auditLogRecord.status,
    subject: auditLogRecord.subject,
    toolId: auditLogRecord.toolId,
  }
}

/**
 * 提供文档路径约定下的 AI 审计日志分页接口。
 */
export const aiAuditListProcedure = requireAnyPermission([
  { action: 'read', subject: 'AiAuditLog' },
  { action: 'manage', subject: 'all' },
])
  .route({
    method: 'GET',
    path: '/api/v1/ai/audit',
    tags: ['AI:Audit'],
    summary: '分页查询 AI 审计日志',
    description: '返回 AI Tool 调用审计轨迹、反馈汇总和主体权限上下文。',
  })
  .input(listAiAuditLogsInputSchema)
  .output(aiAuditListResponseSchema)
  .handler(async ({ input }) => listAiAuditLogs(input))

/**
 * 提供单条 AI 审计日志详情接口，供治理页面回放完整处置链路。
 */
export const aiAuditGetByIdProcedure = requireAnyPermission([
  { action: 'read', subject: 'AiAuditLog' },
  { action: 'manage', subject: 'all' },
])
  .route({
    method: 'GET',
    path: '/api/v1/ai/audit/:id',
    tags: ['AI:Audit'],
    summary: '读取单条 AI 审计日志详情',
    description: '返回单条 AI 审计日志的主体上下文、反馈链路和请求上下文。',
  })
  .input(getAiAuditLogByIdInputSchema)
  .output(aiAuditDetailSchema)
  .handler(async ({ input }) => getAiAuditLogDetail(input))
