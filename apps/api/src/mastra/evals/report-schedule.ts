import { randomUUID } from 'node:crypto'

import { aiEvalTriggerSourceSchema } from '@ai-native-os/shared'
import { createScorer } from '@mastra/core/evals'
import { z } from 'zod'

import {
  createReportScheduleTaskRequestContext,
  reportScheduleWorkflowInputSchema,
  reportScheduleWorkflowOutputSchema,
  runReportScheduleWorkflow,
} from '../workflows/report-schedule'
import type { MastraEvalSuite } from './types'

const reportScheduleEvalGroundTruthSchema = z.object({
  expectedTriggerSource: aiEvalTriggerSourceSchema,
  minRoleCount: z.number().int().min(0),
  minUserCount: z.number().int().min(0),
})

const reportScheduleEvalInputSchema = reportScheduleWorkflowInputSchema

const reportScheduleStructureScorer = createScorer({
  id: 'report_schedule_structure',
  description: '检查报表 workflow 输出是否满足基础结构与最小数据量要求。',
  type: {
    input: reportScheduleEvalInputSchema,
    output: reportScheduleWorkflowOutputSchema,
  },
})
  .generateScore(({ run }) => {
    const groundTruth = reportScheduleEvalGroundTruthSchema.parse(run.groundTruth)
    const hasGeneratedAt = Number.isFinite(Date.parse(run.output.snapshot.generatedAt))
    const hasUserCount = run.output.snapshot.counts.users >= groundTruth.minUserCount
    const hasRoleCount = run.output.snapshot.counts.roles >= groundTruth.minRoleCount

    return hasGeneratedAt && hasUserCount && hasRoleCount ? 1 : 0
  })
  .generateReason(({ run, score }) => {
    const groundTruth = reportScheduleEvalGroundTruthSchema.parse(run.groundTruth)

    if (score === 1) {
      return `snapshot counts satisfy users>=${groundTruth.minUserCount} and roles>=${groundTruth.minRoleCount}`
    }

    return `snapshot counts or generatedAt are invalid, expected users>=${groundTruth.minUserCount}, roles>=${groundTruth.minRoleCount}`
  })

const reportScheduleTriggerScorer = createScorer({
  id: 'report_schedule_trigger_source',
  description: '检查 workflow 输出的触发来源是否与评估基准一致。',
  type: {
    input: reportScheduleEvalInputSchema,
    output: reportScheduleWorkflowOutputSchema,
  },
})
  .generateScore(({ run }) => {
    const groundTruth = reportScheduleEvalGroundTruthSchema.parse(run.groundTruth)

    return run.output.triggerSource === groundTruth.expectedTriggerSource ? 1 : 0
  })
  .generateReason(({ run, score }) => {
    const groundTruth = reportScheduleEvalGroundTruthSchema.parse(run.groundTruth)

    if (score === 1) {
      return `trigger source matches ${groundTruth.expectedTriggerSource}`
    }

    return `trigger source mismatch: got ${run.output.triggerSource}, expected ${groundTruth.expectedTriggerSource}`
  })

const reportScheduleRequestIdScorer = createScorer({
  id: 'report_schedule_request_id',
  description: '检查 workflow 输出是否携带可追踪 requestId。',
  type: {
    input: reportScheduleEvalInputSchema,
    output: reportScheduleWorkflowOutputSchema,
  },
})
  .generateScore(({ run }) => {
    return run.output.requestId.startsWith('eval-report-schedule-') ? 1 : 0
  })
  .generateReason(({ run, score }) => {
    if (score === 1) {
      return 'workflow output includes eval requestId prefix'
    }

    return `workflow output requestId missing eval prefix: ${run.output.requestId}`
  })

const reportScheduleEvalSeedItems = [
  {
    groundTruth: {
      expectedTriggerSource: 'test',
      minRoleCount: 1,
      minUserCount: 1,
    },
    input: {
      reportLabel: 'eval-report-schedule-test',
      scheduledAt: null,
      triggerSource: 'test',
    },
  },
  {
    groundTruth: {
      expectedTriggerSource: 'manual',
      minRoleCount: 1,
      minUserCount: 1,
    },
    input: {
      reportLabel: 'eval-report-schedule-manual',
      scheduledAt: null,
      triggerSource: 'manual',
    },
  },
  {
    groundTruth: {
      expectedTriggerSource: 'schedule',
      minRoleCount: 1,
      minUserCount: 1,
    },
    input: {
      reportLabel: 'eval-report-schedule-schedule',
      scheduledAt: new Date().toISOString(),
      triggerSource: 'schedule',
    },
  },
] as const

/**
 * report-schedule workflow 的评估配置。
 *
 * 约束：
 * - 只评估当前已上线的只读 workflow，不新增高权限写操作
 * - scorer 采用确定性规则，避免把 CI 稳定性绑定到外部模型调用
 */
export const reportScheduleEvalSuite = {
  datasetDescription: 'Baseline dataset for report-schedule workflow integrity and traceability.',
  datasetName: 'report-schedule-workflow-eval',
  execute: async (input, context) => {
    const parsedInput = reportScheduleEvalInputSchema.parse(input)
    const requestContext = createReportScheduleTaskRequestContext(
      `eval-report-schedule-${context.triggerSource}-${randomUUID()}`,
    )

    return runReportScheduleWorkflow({
      input: parsedInput,
      requestContext,
    })
  },
  id: 'report-schedule',
  name: 'Report Schedule Workflow Eval',
  notes:
    'Evaluates workflow output structure, trigger-source correctness, and request-id traceability.',
  scorerThresholds: {
    report_schedule_request_id: 1,
    report_schedule_structure: 1,
    report_schedule_trigger_source: 1,
  },
  scorers: [
    reportScheduleStructureScorer,
    reportScheduleTriggerScorer,
    reportScheduleRequestIdScorer,
  ],
  seedItems: reportScheduleEvalSeedItems,
  targetId: 'report-schedule',
  targetType: 'workflow',
} as const satisfies MastraEvalSuite
