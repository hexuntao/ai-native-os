import {
  createReportScheduleTaskRequestContext,
  type ReportScheduleWorkflowInput,
  type ReportScheduleWorkflowOutput,
  reportScheduleWorkflowInputSchema,
  runReportScheduleWorkflow,
} from '@ai-native-os/api/mastra/workflows/report-schedule'
import { writeAiAuditLog } from '@ai-native-os/db'
import { schedules } from '@trigger.dev/sdk/v3'

export interface ReportScheduleTaskResult {
  taskId: 'report-schedule-trigger'
  workflow: ReportScheduleWorkflowOutput
}

/**
 * 执行 Trigger.dev 报表任务的纯函数入口。
 *
 * 职责边界：
 * - 只负责编排只读报表 workflow，不直接访问未授权的内部 API 路由
 * - 为 workflow 提供一条最小权限的内部 requestContext，并补充 task 级审计
 * - 当前阶段不发送通知、不写业务数据、不引入人工审批节点
 */
export async function executeReportScheduleTask(
  input?: Partial<ReportScheduleWorkflowInput>,
): Promise<ReportScheduleTaskResult> {
  const requestContext = createReportScheduleTaskRequestContext()
  const contextValues = requestContext.all
  const workflowInput = reportScheduleWorkflowInputSchema.parse({
    reportLabel: input?.reportLabel ?? 'daily-system-snapshot',
    scheduledAt: input?.scheduledAt ?? new Date().toISOString(),
    triggerSource: input?.triggerSource ?? 'schedule',
  })

  try {
    const workflow = await runReportScheduleWorkflow({
      input: workflowInput,
      requestContext,
    })

    await writeAiAuditLog({
      action: 'export',
      actorAuthUserId: contextValues.authUserId,
      actorRbacUserId: contextValues.rbacUserId,
      input: workflowInput,
      output: workflow,
      requestInfo: {
        requestId: workflow.requestId,
        triggerSource: workflow.triggerSource,
      },
      roleCodes: contextValues.roleCodes,
      status: 'success',
      subject: 'Report',
      toolId: 'task:report-schedule-trigger',
    })

    return {
      taskId: 'report-schedule-trigger',
      workflow,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    await writeAiAuditLog({
      action: 'export',
      actorAuthUserId: contextValues.authUserId,
      actorRbacUserId: contextValues.rbacUserId,
      errorMessage: message,
      input: workflowInput,
      requestInfo: {
        requestId: contextValues.requestId,
        triggerSource: workflowInput.triggerSource,
      },
      roleCodes: contextValues.roleCodes,
      status: 'error',
      subject: 'Report',
      toolId: 'task:report-schedule-trigger',
    })

    throw error
  }
}

/**
 * 定时报表任务。
 *
 * 权限与审计：
 * - 任务执行不暴露额外外部入口，只在 Trigger.dev worker 内部运行
 * - 任务与 workflow 都会落独立 AI 审计日志，便于排查调度链路
 */
export const reportScheduleTask = schedules.task({
  id: 'report-schedule-trigger',
  cron: {
    pattern: '0 8 * * *',
    timezone: 'Asia/Shanghai',
  },
  run: async () => executeReportScheduleTask(),
})
