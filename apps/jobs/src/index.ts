export { aiEvalRunnerTask, executeAiEvalRunnerTask } from './trigger/ai-eval-runner'
export { executeRagIndexingTask, ragIndexingTask } from './trigger/rag-indexing'
export { executeReportScheduleTask, reportScheduleTask } from './trigger/report-schedule'

/**
 * Trigger.dev jobs runtime 摘要。
 *
 * 职责边界：
 * - 只暴露当前 jobs worker 已注册的调度入口
 * - 不承载业务权限判断；真实权限边界由 workflow/tool 运行链路控制
 */
export const jobsRuntime = {
  name: '@ai-native-os/jobs',
  scheduledTaskIds: ['report-schedule-trigger', 'ai-eval-runner'],
  status: 'workflow-orchestration-ready',
  taskIds: ['rag-indexing', 'report-schedule-trigger', 'ai-eval-runner'],
  triggerConfigPath: 'apps/jobs/trigger.config.ts',
} as const
