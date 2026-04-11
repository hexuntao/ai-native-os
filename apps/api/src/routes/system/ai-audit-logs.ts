import { getAiFeedbackAggregatesByAuditLogIds, listRecentAiAuditLogs } from '@ai-native-os/db'
import { aiAuditLogListResponseSchema } from '@ai-native-os/shared'

import { requirePermission } from '@/orpc/procedures'

export const aiAuditLogsProcedure = requirePermission('read', 'AiAuditLog')
  .route({
    method: 'GET',
    path: '/api/v1/system/ai/audit-logs/recent',
    tags: ['System:AI'],
    summary: '读取最近 AI 审计日志',
    description: '返回最近一批 AI Tool 执行审计日志，供 system 辅助入口快速概览。',
  })
  .output(aiAuditLogListResponseSchema)
  .handler(async () => {
    const rows = await listRecentAiAuditLogs(20)
    const feedbackAggregates = await getAiFeedbackAggregatesByAuditLogIds(rows.map((row) => row.id))

    return {
      logs: rows.map((row) => ({
        ...(feedbackAggregates.get(row.id) ?? {
          feedbackCount: 0,
          latestFeedbackAt: null,
          latestUserAction: null,
        }),
        action: row.action,
        actorAuthUserId: row.actorAuthUserId,
        actorRbacUserId: row.actorRbacUserId,
        createdAt: row.createdAt.toISOString(),
        errorMessage: row.errorMessage,
        humanOverride: row.humanOverride,
        id: row.id,
        requestId: row.requestInfo?.requestId ?? null,
        roleCodes: row.roleCodes,
        status: row.status,
        subject: row.subject,
        toolId: row.toolId,
      })),
    }
  })
