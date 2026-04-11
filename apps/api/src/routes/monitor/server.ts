import { serverSummarySchema } from '@ai-native-os/shared'

import { getApiHealthSnapshot } from '@/lib/health'
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
    summary: '读取服务端运行时摘要',
    description: '返回 API 健康状态、遥测状态和 Mastra 运行时摘要，供监控页展示。',
  })
  .output(serverSummarySchema)
  .handler(async () => {
    const healthSnapshot = await getApiHealthSnapshot()
    const runtimeSummary = getMastraRuntimeSummary()

    return {
      environment: {
        nodeEnv: process.env.NODE_ENV ?? 'development',
        port: Number.parseInt(process.env.PORT ?? '3001', 10),
      },
      health: {
        ...healthSnapshot.checks,
        status: healthSnapshot.status,
      },
      runtime: {
        agentCount: runtimeSummary.agentCount,
        enabledAgentCount: runtimeSummary.enabledAgentCount,
        runtimeStage: runtimeSummary.runtimeStage,
        toolCount: runtimeSummary.toolCount,
        workflowCount: runtimeSummary.workflowCount,
      },
    }
  })
