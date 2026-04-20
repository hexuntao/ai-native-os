import { z } from 'zod'

import { aiEvalRunStatusSchema } from './ai-evals'
import { aiFeedbackEntrySchema, aiFeedbackUserActionSchema } from './ai-feedback'
import { promptKeySchema, promptVersionEntrySchema } from './ai-prompts'
import {
  promptGovernanceFailureAuditSchema,
  promptReleaseAuditSchema,
  promptRollbackChainSchema,
  promptVersionCompareSchema,
  promptVersionHistorySchema,
} from './business-api'
import { withOpenApiSchemaDoc } from './openapi-doc'

const governancePaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().min(1).max(120).optional(),
})

export const aiGovernanceReviewActionSchema = withOpenApiSchemaDoc(
  z.enum([
    'activate_ready_version',
    'attach_eval_evidence',
    'investigate_exception',
    'review_release_gate',
    'review_override',
    'watch_stable',
  ]),
  {
    title: 'AiGovernanceReviewAction',
    description: '治理工作台为当前 Prompt 治理键生成的下一步建议动作。',
    examples: ['attach_eval_evidence', 'activate_ready_version', 'investigate_exception'],
  },
)

export const aiGovernanceReviewToneSchema = withOpenApiSchemaDoc(
  z.enum(['critical', 'neutral', 'warning']),
  {
    title: 'AiGovernanceReviewTone',
    description: '治理工作台给当前审阅条目分配的风险等级语气。',
    examples: ['critical', 'warning', 'neutral'],
  },
)

export const listAiGovernanceOverviewInputSchema = withOpenApiSchemaDoc(
  governancePaginationSchema,
  {
    title: 'ListAiGovernanceOverviewInput',
    description: 'AI 治理总览查询参数，用于分页读取 Prompt 治理 review queue。',
    examples: [
      {
        page: 1,
        pageSize: 10,
        search: 'admin.copilot',
      },
    ],
  },
)

export const getPromptGovernanceReviewInputSchema = withOpenApiSchemaDoc(
  z.object({
    promptKey: promptKeySchema,
  }),
  {
    title: 'GetPromptGovernanceReviewInput',
    description: '按 Prompt 治理键读取完整治理读模型。',
    examples: [
      {
        promptKey: 'admin.copilot.answer',
      },
    ],
  },
)

export const aiGovernanceLinkedEvalSchema = withOpenApiSchemaDoc(
  z.object({
    configured: withOpenApiSchemaDoc(z.boolean(), {
      title: 'AiGovernanceLinkedEvalConfigured',
      description: '当前评测运行时是否已配置完成。',
      examples: [true],
    }),
    datasetSize: withOpenApiSchemaDoc(z.number().int().min(0).nullable(), {
      title: 'AiGovernanceLinkedEvalDatasetSize',
      description: '关联评测套件的数据集规模；未匹配到套件时为 `null`。',
      examples: [12],
    }),
    evalKey: withOpenApiSchemaDoc(z.string().nullable(), {
      title: 'AiGovernanceLinkedEvalKey',
      description: '关联评测键；未绑定评测证据时为 `null`。',
      examples: ['report-schedule'],
    }),
    evalName: withOpenApiSchemaDoc(z.string().nullable(), {
      title: 'AiGovernanceLinkedEvalName',
      description: '关联评测名称；未匹配到套件时为 `null`。',
      examples: ['Report Schedule Regression'],
    }),
    evidenceRunId: withOpenApiSchemaDoc(z.string().uuid().nullable(), {
      title: 'AiGovernanceLinkedEvalRunId',
      description: '当前 Prompt 版本绑定的 eval run ID；未绑定时为 `null`。',
      examples: ['5b7d3be0-6f15-46ec-8ea6-3189d085f001'],
    }),
    evidenceScoreAverage: withOpenApiSchemaDoc(z.number().min(0).max(1).nullable(), {
      title: 'AiGovernanceLinkedEvalScoreAverage',
      description: '绑定评测证据的平均分；未绑定时为 `null`。',
      examples: [0.91],
    }),
    evidenceStatus: withOpenApiSchemaDoc(aiEvalRunStatusSchema.nullable(), {
      title: 'AiGovernanceLinkedEvalStatus',
      description: '绑定评测证据的运行状态；未绑定时为 `null`。',
      examples: ['completed'],
    }),
    lastRunAt: withOpenApiSchemaDoc(z.string().nullable(), {
      title: 'AiGovernanceLinkedEvalLastRunAt',
      description: '关联评测套件最近一次运行时间；未匹配到套件或从未运行时为 `null`。',
      examples: ['2026-04-11T04:30:00.000Z'],
    }),
    lastRunAverageScore: withOpenApiSchemaDoc(z.number().min(0).max(1).nullable(), {
      title: 'AiGovernanceLinkedEvalLastRunAverageScore',
      description: '关联评测套件最近一次运行平均分；未匹配或从未运行时为 `null`。',
      examples: [0.91],
    }),
    lastRunStatus: withOpenApiSchemaDoc(aiEvalRunStatusSchema.nullable(), {
      title: 'AiGovernanceLinkedEvalLastRunStatus',
      description: '关联评测套件最近一次运行状态；未匹配或从未运行时为 `null`。',
      examples: ['completed'],
    }),
    scorerCount: withOpenApiSchemaDoc(z.number().int().min(0).nullable(), {
      title: 'AiGovernanceLinkedEvalScorerCount',
      description: '关联评测套件 scorer 数量；未匹配到套件时为 `null`。',
      examples: [3],
    }),
  }),
  {
    title: 'AiGovernanceLinkedEval',
    description: 'Prompt 治理视角下的评测绑定摘要，用于连接 eval 证据与发布门禁。',
    examples: [
      {
        configured: true,
        datasetSize: 12,
        evalKey: 'report-schedule',
        evalName: 'Report Schedule Regression',
        evidenceRunId: '5b7d3be0-6f15-46ec-8ea6-3189d085f001',
        evidenceScoreAverage: 0.91,
        evidenceStatus: 'completed',
        lastRunAt: '2026-04-11T04:30:00.000Z',
        lastRunAverageScore: 0.91,
        lastRunStatus: 'completed',
        scorerCount: 3,
      },
    ],
  },
)

export const aiGovernanceReviewItemSchema = withOpenApiSchemaDoc(
  z.object({
    activeVersionId: withOpenApiSchemaDoc(z.string().uuid().nullable(), {
      title: 'AiGovernanceReviewActiveVersionId',
      description: '当前 Prompt 治理键的激活版本 ID；没有激活版本时为 `null`。',
      examples: ['b87ecb02-478d-40ff-b2d8-3f62fd9f9001'],
    }),
    failureCount: withOpenApiSchemaDoc(z.number().int().min(0), {
      title: 'AiGovernanceReviewFailureCount',
      description: '当前 Prompt 治理键累计失败事件总数。',
      examples: [2],
    }),
    hasHumanOverride: withOpenApiSchemaDoc(z.boolean(), {
      title: 'AiGovernanceReviewHasHumanOverride',
      description: '当前治理切片是否存在人工 override 信号。',
      examples: [true],
    }),
    latestFailureAt: withOpenApiSchemaDoc(z.string().nullable(), {
      title: 'AiGovernanceReviewLatestFailureAt',
      description: '最近失败事件时间；没有失败事件时为 `null`。',
      examples: ['2026-04-11T05:10:00.000Z'],
    }),
    latestFailureKind: withOpenApiSchemaDoc(z.enum(['exception', 'rejection']).nullable(), {
      title: 'AiGovernanceReviewLatestFailureKind',
      description: '最近失败事件类型；没有失败事件时为 `null`。',
      examples: ['rejection'],
    }),
    latestFeedbackAction: withOpenApiSchemaDoc(aiFeedbackUserActionSchema.nullable(), {
      title: 'AiGovernanceReviewLatestFeedbackAction',
      description: '当前治理切片最近一次人工反馈动作；没有反馈时为 `null`。',
      examples: ['overridden'],
    }),
    latestVersion: promptVersionEntrySchema,
    promptKey: promptKeySchema,
    releaseReadyCount: withOpenApiSchemaDoc(z.number().int().min(0), {
      title: 'AiGovernanceReviewReleaseReadyCount',
      description: '当前 Prompt 治理键下满足发布门禁的版本数量。',
      examples: [1],
    }),
    reviewAction: aiGovernanceReviewActionSchema,
    reviewReason: withOpenApiSchemaDoc(z.string(), {
      title: 'AiGovernanceReviewReason',
      description: '推荐动作对应的治理解释，便于运营和审计快速理解下一步。',
      examples: ['当前版本已满足门禁但仍停留在草稿态，建议人工复核后激活。'],
    }),
    tone: aiGovernanceReviewToneSchema,
    totalVersions: withOpenApiSchemaDoc(z.number().int().min(1), {
      title: 'AiGovernanceReviewTotalVersions',
      description: '当前 Prompt 治理键的累计版本数。',
      examples: [3],
    }),
  }),
  {
    title: 'AiGovernanceReviewItem',
    description: 'AI 治理 review queue 中的一条 Prompt 治理条目。',
    examples: [
      {
        activeVersionId: 'b87ecb02-478d-40ff-b2d8-3f62fd9f9001',
        failureCount: 1,
        hasHumanOverride: true,
        latestFailureAt: '2026-04-11T05:10:00.000Z',
        latestFailureKind: 'rejection',
        latestFeedbackAction: 'overridden',
        latestVersion: {
          activatedAt: null,
          activatedByAuthUserId: null,
          activatedByRbacUserId: null,
          createdAt: '2026-04-11T04:00:00.000Z',
          createdByAuthUserId: 'auth_user_01',
          createdByRbacUserId: '8c8d0f66-c9db-4c4e-9d82-f1c70d6ef001',
          evalEvidence: null,
          id: 'b87ecb02-478d-40ff-b2d8-3f62fd9f9001',
          isActive: false,
          notes: '提高财务问答的事实一致性。',
          promptKey: 'admin.copilot.answer',
          promptText: '你是后台管理 Copilot，请优先返回结构化结论。',
          releasePolicy: {
            minAverageScore: 0.8,
            scorerThresholds: {
              factuality: 0.9,
            },
          },
          releaseReady: false,
          releaseReason: '缺少评测证据。',
          rolledBackFromVersionId: null,
          status: 'draft',
          updatedAt: '2026-04-11T04:00:00.000Z',
          version: 3,
        },
        promptKey: 'admin.copilot.answer',
        releaseReadyCount: 0,
        reviewAction: 'attach_eval_evidence',
        reviewReason: '当前版本还没有绑定评测证据，门禁无法判断是否可发布。',
        tone: 'warning',
        totalVersions: 3,
      },
    ],
  },
)

export const aiGovernanceOverviewSchema = withOpenApiSchemaDoc(
  z.object({
    pagination: withOpenApiSchemaDoc(
      z.object({
        page: z.number().int().min(1),
        pageSize: z.number().int().min(1),
        total: z.number().int().min(0),
        totalPages: z.number().int().min(1),
      }),
      {
        title: 'AiGovernanceOverviewPagination',
        description: '治理 review queue 的分页信息。',
      },
    ),
    recentFeedback: withOpenApiSchemaDoc(z.array(aiFeedbackEntrySchema), {
      title: 'AiGovernanceRecentFeedback',
      description:
        '最近的人工反馈与 override 记录，用于把 Prompt 治理和人工接管信号放到同一工作台。',
    }),
    reviewQueue: withOpenApiSchemaDoc(z.array(aiGovernanceReviewItemSchema), {
      title: 'AiGovernanceReviewQueue',
      description: '当前治理工作台的 Prompt review queue。',
    }),
    summary: withOpenApiSchemaDoc(
      z.object({
        activePromptKeys: z.number().int().min(0),
        evalConfigured: z.boolean(),
        humanOverrideCount: z.number().int().min(0),
        promptFailureEvents: z.number().int().min(0),
        rejectionEventCount: z.number().int().min(0),
        exceptionEventCount: z.number().int().min(0),
        releaseReadyPromptVersions: z.number().int().min(0),
        totalPromptKeys: z.number().int().min(0),
        totalPromptVersions: z.number().int().min(0),
        totalEvalDatasets: z.number().int().min(0),
        totalEvalExperiments: z.number().int().min(0),
      }),
      {
        title: 'AiGovernanceOverviewSummary',
        description: 'AI 治理总览汇总指标，覆盖 Prompt、Eval 与人工 override 信号。',
        examples: [
          {
            activePromptKeys: 1,
            evalConfigured: true,
            exceptionEventCount: 0,
            humanOverrideCount: 1,
            promptFailureEvents: 2,
            rejectionEventCount: 2,
            releaseReadyPromptVersions: 1,
            totalEvalDatasets: 4,
            totalEvalExperiments: 7,
            totalPromptKeys: 2,
            totalPromptVersions: 5,
          },
        ],
      },
    ),
  }),
  {
    title: 'AiGovernanceOverview',
    description: '统一治理总览读模型，把 Prompt、Eval、Audit 与 Feedback 信号汇总到同一工作台。',
  },
)

export const promptGovernanceReviewSchema = withOpenApiSchemaDoc(
  z.object({
    compareToPrevious: withOpenApiSchemaDoc(promptVersionCompareSchema.nullable(), {
      title: 'PromptGovernanceReviewCompareToPrevious',
      description: '当前 Prompt 治理键最新版本与上一个版本的差异；没有上一版本时为 `null`。',
    }),
    failureAudit: promptGovernanceFailureAuditSchema,
    history: promptVersionHistorySchema,
    latestReleaseAudit: withOpenApiSchemaDoc(promptReleaseAuditSchema.nullable(), {
      title: 'PromptGovernanceReviewLatestReleaseAudit',
      description: '最新版本对应的发布审批审计；当前没有任何版本时为 `null`。',
    }),
    linkedEval: aiGovernanceLinkedEvalSchema,
    promptKey: promptKeySchema,
    reviewItem: aiGovernanceReviewItemSchema,
    rollbackChain: promptRollbackChainSchema,
  }),
  {
    title: 'PromptGovernanceReview',
    description:
      '单个 Prompt 治理键的完整治理读模型，供工作台和审计人员查看历史、失败、回滚和评测绑定。',
  },
)

export type ListAiGovernanceOverviewInput = z.infer<typeof listAiGovernanceOverviewInputSchema>
export type GetPromptGovernanceReviewInput = z.infer<typeof getPromptGovernanceReviewInputSchema>
export type AiGovernanceReviewAction = z.infer<typeof aiGovernanceReviewActionSchema>
export type AiGovernanceReviewTone = z.infer<typeof aiGovernanceReviewToneSchema>
export type AiGovernanceLinkedEval = z.infer<typeof aiGovernanceLinkedEvalSchema>
export type AiGovernanceReviewItem = z.infer<typeof aiGovernanceReviewItemSchema>
export type AiGovernanceOverview = z.infer<typeof aiGovernanceOverviewSchema>
export type PromptGovernanceReview = z.infer<typeof promptGovernanceReviewSchema>
