import { getAiFeedbackAggregatesByAuditLogIds, listRecentAiAuditLogs } from '@ai-native-os/db'
import { aiAuditLogListResponseSchema } from '@ai-native-os/shared'

import { requirePermission } from '@/orpc/procedures'

export const aiAuditLogsProcedure = requirePermission('read', 'AiAuditLog')
  .route({
    method: 'GET',
    path: '/api/v1/system/ai/audit-logs/recent',
    tags: ['System:AI'],
    summary: 'List recent AI audit log entries',
    description: 'Returns recent AI tool execution audits for administrators.',
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
