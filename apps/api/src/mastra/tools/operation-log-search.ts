import { db, operationLogs } from '@ai-native-os/db'
import { desc, eq, type SQL } from 'drizzle-orm'
import { z } from 'zod'

import { defineProtectedMastraTool } from './base'

const operationLogSearchInputSchema = z.object({
  limit: z.number().int().min(1).max(20).optional().default(10),
  status: z.string().trim().min(1).max(20).optional(),
})

const operationLogSearchOutputSchema = z.object({
  logs: z.array(
    z.object({
      action: z.string(),
      createdAt: z.string(),
      detail: z.string(),
      id: z.string().uuid(),
      module: z.string(),
      operatorId: z.string().uuid(),
      status: z.string(),
      targetId: z.string().uuid().nullable(),
    }),
  ),
})

export const operationLogSearchRegistration = defineProtectedMastraTool({
  description: 'Read recent operation logs for backend audit and troubleshooting.',
  execute: async (input) => {
    const parsedInput = operationLogSearchInputSchema.parse(input)
    const conditions: SQL<unknown>[] = []

    if (parsedInput.status) {
      conditions.push(eq(operationLogs.status, parsedInput.status))
    }

    const whereClause =
      conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : undefined

    const rows = await db
      .select({
        action: operationLogs.action,
        createdAt: operationLogs.createdAt,
        detail: operationLogs.detail,
        id: operationLogs.id,
        module: operationLogs.module,
        operatorId: operationLogs.operatorId,
        status: operationLogs.status,
        targetId: operationLogs.targetId,
      })
      .from(operationLogs)
      .where(whereClause)
      .orderBy(desc(operationLogs.createdAt))
      .limit(parsedInput.limit)

    return {
      logs: rows.map((row) => ({
        action: row.action,
        createdAt: row.createdAt.toISOString(),
        detail: row.detail,
        id: row.id,
        module: row.module,
        operatorId: row.operatorId,
        status: row.status,
        targetId: row.targetId,
      })),
    }
  },
  id: 'operation-log-search',
  inputSchema: operationLogSearchInputSchema,
  outputSchema: operationLogSearchOutputSchema,
  permission: {
    action: 'read',
    subject: 'OperationLog',
  },
})
