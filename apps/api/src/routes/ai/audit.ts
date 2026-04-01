import { aiAuditLogs, db, getAiFeedbackAggregatesByAuditLogIds } from '@ai-native-os/db'
import {
  type AiAuditListResponse,
  type AppActions,
  type AppSubjects,
  aiAuditListResponseSchema,
  type ListAiAuditLogsInput,
  listAiAuditLogsInputSchema,
} from '@ai-native-os/shared'
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
    summary: 'List AI audit log entries',
    description: 'Returns paginated AI tool audit logs under the documented AI API namespace.',
  })
  .input(listAiAuditLogsInputSchema)
  .output(aiAuditListResponseSchema)
  .handler(async ({ input }) => listAiAuditLogs(input))
