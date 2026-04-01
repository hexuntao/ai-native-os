import { listRecentAiAuditLogs } from '@ai-native-os/db'
import { z } from 'zod'

import { defineProtectedMastraTool } from './base'

const aiAuditLogSearchInputSchema = z.object({
  limit: z.number().int().min(1).max(20).optional().default(10),
  status: z.enum(['error', 'forbidden', 'success']).optional(),
})

const aiAuditLogSearchOutputSchema = z.object({
  logs: z.array(
    z.object({
      action: z.string(),
      actorAuthUserId: z.string(),
      actorRbacUserId: z.string().uuid().nullable(),
      createdAt: z.string(),
      errorMessage: z.string().nullable(),
      id: z.string().uuid(),
      requestId: z.string().nullable(),
      roleCodes: z.array(z.string()),
      status: z.enum(['error', 'forbidden', 'success']),
      subject: z.string(),
      toolId: z.string(),
    }),
  ),
})

export const aiAuditLogSearchRegistration = defineProtectedMastraTool({
  description: 'Inspect recent AI tool audit entries written by the Mastra runtime.',
  execute: async (input) => {
    const parsedInput = aiAuditLogSearchInputSchema.parse(input)
    const rows = await listRecentAiAuditLogs(parsedInput.limit)
    const filteredRows = parsedInput.status
      ? rows.filter((row) => row.status === parsedInput.status)
      : rows

    return {
      logs: filteredRows.map((row) => ({
        action: row.action,
        actorAuthUserId: row.actorAuthUserId,
        actorRbacUserId: row.actorRbacUserId,
        createdAt: row.createdAt.toISOString(),
        errorMessage: row.errorMessage,
        id: row.id,
        requestId: row.requestInfo?.requestId ?? null,
        roleCodes: row.roleCodes,
        status: row.status,
        subject: row.subject,
        toolId: row.toolId,
      })),
    }
  },
  id: 'ai-audit-log-search',
  inputSchema: aiAuditLogSearchInputSchema,
  outputSchema: aiAuditLogSearchOutputSchema,
  permission: {
    action: 'read',
    subject: 'AiAuditLog',
  },
})
