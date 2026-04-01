import { db } from '@ai-native-os/db'
import { serverSummarySchema } from '@ai-native-os/shared'
import { sql } from 'drizzle-orm'

import { getMastraRuntimeSummary } from '@/mastra'
import { requireAnyPermission } from '@/orpc/procedures'

/**
 * 提供监控页的服务端摘要。
 *
 * 这里保持与 `/health` 一致的检查口径，避免监控页与健康检查出现相互矛盾的状态。
 */
export const monitorServerSummaryProcedure = requireAnyPermission([
  { action: 'read', subject: 'OperationLog' },
  { action: 'manage', subject: 'all' },
])
  .route({
    method: 'GET',
    path: '/api/v1/monitor/server',
    tags: ['Monitor:Server'],
    summary: 'Get server runtime summary',
    description: 'Returns current API health and Mastra runtime summary for monitor dashboards.',
  })
  .output(serverSummarySchema)
  .handler(async () => {
    let database: 'ok' | 'error' = 'ok'

    try {
      await db.execute(sql`select 1`)
    } catch {
      database = 'error'
    }

    const runtimeSummary = getMastraRuntimeSummary()

    return {
      environment: {
        nodeEnv: process.env.NODE_ENV ?? 'development',
        port: Number.parseInt(process.env.PORT ?? '3001', 10),
      },
      health: {
        api: 'ok',
        database,
        redis: 'unknown',
        status: database === 'ok' ? 'ok' : 'degraded',
      },
      runtime: {
        agentCount: runtimeSummary.agentCount,
        runtimeStage: runtimeSummary.runtimeStage,
        toolCount: runtimeSummary.toolCount,
        workflowCount: runtimeSummary.workflowCount,
      },
    }
  })
