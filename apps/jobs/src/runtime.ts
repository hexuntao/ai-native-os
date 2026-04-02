import { scheduledTriggerJobIds, triggerJobIds } from '@ai-native-os/shared'

/**
 * Trigger.dev jobs runtime 摘要。
 *
 * 职责边界：
 * - 只暴露当前 jobs worker 已注册的调度入口
 * - 不承载业务权限判断；真实权限边界由 workflow/tool 运行链路控制
 */
export const jobsRuntime = {
  name: '@ai-native-os/jobs',
  scheduledTaskIds: [...scheduledTriggerJobIds],
  status: 'workflow-orchestration-ready',
  taskIds: [...triggerJobIds],
  triggerConfigPath: 'apps/jobs/trigger.config.ts',
} as const
