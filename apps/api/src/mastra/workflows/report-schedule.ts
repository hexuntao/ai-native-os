import { randomUUID } from 'node:crypto'

import { writeAiAuditLog } from '@ai-native-os/db'
import type { PermissionRule } from '@ai-native-os/shared'
import type { Tool, ToolExecutionContext } from '@mastra/core/tools'
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'

import {
  createMastraRequestContext,
  type MastraToolRequestContextValues,
  mastraToolRequestContextSchema,
  readMastraRequestContext,
} from '../request-context'
import {
  reportDataSnapshotInputSchema,
  reportDataSnapshotOutputSchema,
  reportDataSnapshotRegistration,
} from '../tools/report-data-snapshot'

const reportScheduleTriggerSources = ['manual', 'schedule', 'test'] as const

/**
 * 定时报表 Workflow。
 *
 * 职责边界：
 * - 负责把“报表触发事件”编排为受控的只读数据快照生成流程
 * - 仅调用 `report-data-snapshot` 这类受 RBAC 与审计保护的只读 Tool
 * - 当前阶段禁止审批、写库变更、外部通知发送和高权限系统操作
 *
 * 权限与审计：
 * - Workflow 自身要求 `export:Report` 最小权限
 * - Workflow 成功或失败都会补充一条聚合级 AI 审计日志
 * - 内部调度上下文仅授予本 Workflow 所需的最小权限，不等价于管理员身份
 */
export const reportScheduleWorkflowInputSchema = z.object({
  reportLabel: z.string().min(1),
  scheduledAt: z.string().datetime().nullable().optional(),
  triggerSource: z.enum(reportScheduleTriggerSources),
})

export const reportScheduleWorkflowOutputSchema = z.object({
  reportLabel: z.string(),
  requestId: z.string(),
  scheduledAt: z.string().datetime().nullable(),
  snapshot: reportDataSnapshotOutputSchema,
  triggerSource: z.enum(reportScheduleTriggerSources),
})

export type ReportScheduleWorkflowInput = z.infer<typeof reportScheduleWorkflowInputSchema>
export type ReportScheduleWorkflowOutput = z.infer<typeof reportScheduleWorkflowOutputSchema>

const workflowAuditToolId = 'workflow:report-schedule'
const reportSchedulePermissionRules = [
  {
    action: 'export',
    subject: 'Report',
  },
] as const satisfies readonly PermissionRule[]

const prepareReportSnapshotInputStep = createStep({
  id: 'prepare-report-data-snapshot-input',
  description: '校验报表触发参数，并准备下游只读快照工具所需的空输入。',
  inputSchema: reportScheduleWorkflowInputSchema,
  outputSchema: reportDataSnapshotInputSchema,
  requestContextSchema: mastraToolRequestContextSchema,
  // 这里显式保留一个准备步骤，避免后续扩展更多输入映射时直接改动 Tool 契约。
  execute: async ({ inputData }) => {
    reportScheduleWorkflowInputSchema.parse(inputData)
    return {}
  },
})

const reportDataSnapshotStep = createStep(
  reportDataSnapshotRegistration.tool as Tool<
    z.infer<typeof reportDataSnapshotInputSchema>,
    z.infer<typeof reportDataSnapshotOutputSchema>,
    unknown,
    unknown,
    ToolExecutionContext<unknown, unknown, MastraToolRequestContextValues>,
    'report-data-snapshot',
    MastraToolRequestContextValues
  >,
)

const finalizeReportScheduleStep = createStep({
  id: 'finalize-report-schedule',
  description: '把底层快照结果与调度元数据组装成稳定的 workflow 输出。',
  inputSchema: reportDataSnapshotOutputSchema,
  outputSchema: reportScheduleWorkflowOutputSchema,
  requestContextSchema: mastraToolRequestContextSchema,
  // 终态输出会把 requestId 带回上层，便于 jobs、API 和审计系统做链路关联。
  execute: async ({ getInitData, inputData, requestContext }) => {
    const initData = reportScheduleWorkflowInputSchema.parse(
      getInitData<ReportScheduleWorkflowInput>(),
    )
    const contextValues = readMastraRequestContext(requestContext)

    return {
      reportLabel: initData.reportLabel,
      requestId: contextValues.requestId,
      scheduledAt: initData.scheduledAt ?? null,
      snapshot: reportDataSnapshotOutputSchema.parse(inputData),
      triggerSource: initData.triggerSource,
    }
  },
})

export const reportSchedule = createWorkflow({
  id: 'report-schedule',
  description: 'Generate a read-only scheduled report snapshot for operational reporting flows.',
  inputSchema: reportScheduleWorkflowInputSchema,
  outputSchema: reportScheduleWorkflowOutputSchema,
  requestContextSchema: mastraToolRequestContextSchema,
})
  .then(prepareReportSnapshotInputStep)
  .then(reportDataSnapshotStep)
  .then(finalizeReportScheduleStep)
  .commit()

/**
 * 为内部 Trigger.dev 报表任务创建最小权限上下文。
 *
 * 重要约束：
 * - 该上下文只供进程内调度器调用，不对应任何外部 HTTP 后门
 * - 仅授予 `export:Report`，不能复用为通用系统管理员主体
 */
export function createReportScheduleTaskRequestContext(
  requestId = `trigger-report-schedule-${randomUUID()}`,
): ReturnType<typeof createMastraRequestContext> {
  return createMastraRequestContext({
    authUserId: 'system:trigger-jobs',
    permissionRules: [...reportSchedulePermissionRules],
    rbacUserId: null,
    requestId,
    roleCodes: ['system_scheduler'],
    userEmail: null,
  })
}

function createWorkflowFailureError(status: string, error?: Error): Error {
  if (status === 'failed' && error) {
    return error
  }

  return new Error(`Report schedule workflow ended with status ${status}`)
}

/**
 * 执行报表调度 Workflow，并补充一条 workflow 级审计日志。
 *
 * 这里不尝试放宽安全边界：
 * - 外部请求仍然必须走 Better Auth + Mastra 路由
 * - 内部 jobs 只能通过显式传入的最小权限 requestContext 运行该 workflow
 */
export async function runReportScheduleWorkflow(args: {
  input: ReportScheduleWorkflowInput
  requestContext?: ReturnType<typeof createMastraRequestContext>
}): Promise<ReportScheduleWorkflowOutput> {
  const input = reportScheduleWorkflowInputSchema.parse(args.input)
  const requestContext = args.requestContext ?? createReportScheduleTaskRequestContext()
  const contextValues = readMastraRequestContext(requestContext)

  try {
    const run = await reportSchedule.createRun()
    const result = await run.start({
      inputData: input,
      requestContext,
    })

    if (result.status !== 'success') {
      throw createWorkflowFailureError(
        result.status,
        result.status === 'failed' ? result.error : undefined,
      )
    }

    const output = reportScheduleWorkflowOutputSchema.parse(result.result)

    await writeAiAuditLog({
      action: 'export',
      actorAuthUserId: contextValues.authUserId,
      actorRbacUserId: contextValues.rbacUserId,
      input,
      output,
      requestInfo: {
        requestId: contextValues.requestId,
        triggerSource: input.triggerSource,
      },
      roleCodes: contextValues.roleCodes,
      status: 'success',
      subject: 'Report',
      toolId: workflowAuditToolId,
    })

    return output
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    await writeAiAuditLog({
      action: 'export',
      actorAuthUserId: contextValues.authUserId,
      actorRbacUserId: contextValues.rbacUserId,
      errorMessage: message,
      input,
      requestInfo: {
        requestId: contextValues.requestId,
        triggerSource: input.triggerSource,
      },
      roleCodes: contextValues.roleCodes,
      status: 'error',
      subject: 'Report',
      toolId: workflowAuditToolId,
    })

    throw error
  }
}
