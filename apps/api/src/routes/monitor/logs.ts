import { db, operationLogs } from '@ai-native-os/db'
import {
  type ListOperationLogsInput,
  listOperationLogsInputSchema,
  type OperationLogListResponse,
  operationLogListResponseSchema,
} from '@ai-native-os/shared'
import { and, count, desc, eq, ilike } from 'drizzle-orm'

import { requireAnyPermission } from '@/orpc/procedures'
import { createPagination } from '@/routes/lib/pagination'

/**
 * 提供监控模块的操作日志分页接口。
 */
export async function listMonitorLogs(
  input: ListOperationLogsInput,
): Promise<OperationLogListResponse> {
  const filters = []

  if (input.search) {
    filters.push(ilike(operationLogs.detail, `%${input.search}%`))
  }

  if (input.module) {
    filters.push(eq(operationLogs.module, input.module))
  }

  if (input.status) {
    filters.push(eq(operationLogs.status, input.status))
  }

  const where = filters.length > 0 ? and(...filters) : undefined
  const totalRow = await db.select({ total: count() }).from(operationLogs).where(where)
  const total = totalRow[0]?.total ?? 0
  const pageRows = await db
    .select()
    .from(operationLogs)
    .where(where)
    .orderBy(desc(operationLogs.createdAt))
    .limit(input.pageSize)
    .offset((input.page - 1) * input.pageSize)

  return {
    data: pageRows.map((row) => ({
      action: row.action,
      createdAt: row.createdAt.toISOString(),
      detail: row.detail,
      errorMessage: row.errorMessage,
      id: row.id,
      module: row.module,
      operatorId: row.operatorId,
      requestId: row.requestInfo?.requestId ?? null,
      status: row.status,
      targetId: row.targetId,
    })),
    pagination: createPagination(input.page, input.pageSize, total),
  }
}

/**
 * 提供监控模块的操作日志分页接口。
 */
export const monitorLogsListProcedure = requireAnyPermission([
  { action: 'read', subject: 'OperationLog' },
  { action: 'manage', subject: 'all' },
])
  .route({
    method: 'GET',
    path: '/api/v1/monitor/logs',
    tags: ['Monitor:Logs'],
    summary: 'List operation logs',
    description: 'Returns paginated operation logs for monitor and audit views.',
  })
  .input(listOperationLogsInputSchema)
  .output(operationLogListResponseSchema)
  .handler(async ({ input }) => listMonitorLogs(input))
