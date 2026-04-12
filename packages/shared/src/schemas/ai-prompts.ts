import { z } from 'zod'

import { aiEvalRunStatusSchema, aiEvalScorerSummarySchema } from './ai-evals'
import { paginatedResponseSchema } from './common'
import { withOpenApiSchemaDoc } from './openapi-doc'

export const promptKeySchema = withOpenApiSchemaDoc(
  z
    .string()
    .trim()
    .min(3)
    .max(120)
    .regex(
      /^[a-z0-9._-]+$/,
      'promptKey must use lowercase letters, numbers, dot, underscore, or hyphen',
    ),
  {
    title: 'PromptKey',
    description: 'Prompt 治理键，使用小写字母、数字、点、下划线或连字符表示稳定标识。',
    examples: ['admin.copilot.answer'],
  },
)

const queryPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
})

export const promptVersionStatusSchema = withOpenApiSchemaDoc(
  z.enum(['active', 'archived', 'draft']),
  {
    title: 'PromptVersionStatus',
    description: 'Prompt 版本状态，表示当前版本是草稿、已激活还是已归档。',
    examples: ['draft', 'active', 'archived'],
  },
)

export const promptReleasePolicySchema = withOpenApiSchemaDoc(
  z.object({
    minAverageScore: withOpenApiSchemaDoc(z.number().min(0).max(1).default(0.8), {
      title: 'PromptReleaseMinAverageScore',
      description: '激活 Prompt 前要求的最低平均分阈值。',
      examples: [0.8],
      default: 0.8,
    }),
    scorerThresholds: withOpenApiSchemaDoc(
      z.record(z.string(), z.number().min(0).max(1)).default({}),
      {
        title: 'PromptReleaseScorerThresholds',
        description: '按评分器名称覆盖的最低分阈值映射；为空表示只使用平均分阈值。',
        examples: [{ factuality: 0.9, safety: 0.95 }],
        default: {},
      },
    ),
  }),
  {
    title: 'PromptReleasePolicy',
    description: 'Prompt 发布门禁策略，用于定义激活前必须满足的评测阈值。',
    examples: [
      {
        minAverageScore: 0.8,
        scorerThresholds: {
          factuality: 0.9,
        },
      },
    ],
  },
)

export const promptEvalEvidenceSchema = withOpenApiSchemaDoc(
  z.object({
    completedAt: withOpenApiSchemaDoc(z.string().nullable(), {
      title: 'PromptEvalCompletedAt',
      description: '绑定评测完成时间；未完成时为 `null`。',
      examples: ['2026-04-11T04:30:00.000Z'],
    }),
    evalKey: withOpenApiSchemaDoc(z.string(), {
      title: 'PromptEvalKey',
      description: '评测定义键，用于标识绑定到 Prompt 的评测套件。',
      examples: ['admin-copilot-regression'],
    }),
    evalRunId: withOpenApiSchemaDoc(z.string().uuid(), {
      title: 'PromptEvalRunId',
      description: '绑定的评测运行主键 UUID。',
      examples: ['5b7d3be0-6f15-46ec-8ea6-3189d085f001'],
    }),
    experimentId: withOpenApiSchemaDoc(z.string(), {
      title: 'PromptExperimentId',
      description: '评测实验 ID，用于关联实验追踪记录。',
      examples: ['exp_admin_copilot_20260411'],
    }),
    scoreAverage: withOpenApiSchemaDoc(z.number().min(0).max(1).nullable(), {
      title: 'PromptEvalAverageScore',
      description: '当前评测运行的平均分；未完成时为 `null`。',
      examples: [0.91],
    }),
    scorerSummary: aiEvalScorerSummarySchema,
    status: aiEvalRunStatusSchema,
  }),
  {
    title: 'PromptEvalEvidence',
    description: '已绑定到 Prompt 版本的评测证据，用于发布门禁判断。',
    examples: [
      {
        completedAt: '2026-04-11T04:30:00.000Z',
        evalKey: 'admin-copilot-regression',
        evalRunId: '5b7d3be0-6f15-46ec-8ea6-3189d085f001',
        experimentId: 'exp_admin_copilot_20260411',
        scoreAverage: 0.91,
        scorerSummary: {
          factuality: {
            averageScore: 0.93,
            maxScore: 1,
            minScore: 0.85,
            sampleCount: 12,
          },
        },
        status: 'completed',
      },
    ],
  },
)

export const promptVersionEntrySchema = withOpenApiSchemaDoc(
  z.object({
    activatedAt: withOpenApiSchemaDoc(z.string().nullable(), {
      title: 'PromptActivatedAt',
      description: '当前版本激活时间；未激活时为 `null`。',
      examples: ['2026-04-11T05:00:00.000Z'],
    }),
    activatedByAuthUserId: withOpenApiSchemaDoc(z.string().nullable(), {
      title: 'PromptActivatedByAuthUserId',
      description: '激活该版本的 Better Auth 主体 ID；未激活时为 `null`。',
      examples: ['auth_user_01'],
    }),
    activatedByRbacUserId: withOpenApiSchemaDoc(z.string().uuid().nullable(), {
      title: 'PromptActivatedByRbacUserId',
      description: '激活该版本的应用 RBAC 用户 ID；未映射或未激活时为 `null`。',
      examples: ['8c8d0f66-c9db-4c4e-9d82-f1c70d6ef001'],
    }),
    createdAt: withOpenApiSchemaDoc(z.string(), {
      title: 'PromptCreatedAt',
      description: '版本创建时间，ISO 8601 字符串。',
      examples: ['2026-04-11T04:00:00.000Z'],
    }),
    createdByAuthUserId: withOpenApiSchemaDoc(z.string(), {
      title: 'PromptCreatedByAuthUserId',
      description: '创建该版本的 Better Auth 主体 ID。',
      examples: ['auth_user_01'],
    }),
    createdByRbacUserId: withOpenApiSchemaDoc(z.string().uuid().nullable(), {
      title: 'PromptCreatedByRbacUserId',
      description: '创建该版本的应用 RBAC 用户 ID；未映射时为 `null`。',
      examples: ['8c8d0f66-c9db-4c4e-9d82-f1c70d6ef001'],
    }),
    evalEvidence: withOpenApiSchemaDoc(promptEvalEvidenceSchema.nullable(), {
      title: 'PromptVersionEvalEvidence',
      description: '当前版本已绑定的评测证据；未绑定时为 `null`。',
      examples: [null],
    }),
    id: withOpenApiSchemaDoc(z.string().uuid(), {
      title: 'PromptVersionId',
      description: 'Prompt 版本主键 UUID。',
      examples: ['b87ecb02-478d-40ff-b2d8-3f62fd9f9001'],
    }),
    isActive: withOpenApiSchemaDoc(z.boolean(), {
      title: 'PromptIsActive',
      description: '当前版本是否为正在生效的激活版本。',
      examples: [false],
    }),
    notes: withOpenApiSchemaDoc(z.string().nullable(), {
      title: 'PromptVersionNotes',
      description: '版本备注说明；未填写时为 `null`。',
      examples: ['提高财务问答的事实一致性。'],
    }),
    promptKey: promptKeySchema,
    promptText: withOpenApiSchemaDoc(z.string(), {
      title: 'PromptText',
      description: 'Prompt 正文内容。',
      examples: ['你是后台管理 Copilot，请优先返回结构化结论。'],
    }),
    releasePolicy: promptReleasePolicySchema,
    releaseReady: withOpenApiSchemaDoc(z.boolean(), {
      title: 'PromptReleaseReady',
      description: '当前版本是否已满足发布门禁，可被激活。',
      examples: [true],
    }),
    releaseReason: withOpenApiSchemaDoc(z.string().nullable(), {
      title: 'PromptReleaseReason',
      description: '当前版本未满足门禁时的原因说明；可发布时为 `null`。',
      examples: ['缺少评测证据。'],
    }),
    rolledBackFromVersionId: withOpenApiSchemaDoc(z.string().uuid().nullable(), {
      title: 'PromptRolledBackFromVersionId',
      description: '当前版本是否由回滚产生；若是，则记录被回滚来源版本 ID。',
      examples: ['95f398a5-0b64-4387-8f1c-fd6476412001'],
    }),
    status: promptVersionStatusSchema,
    updatedAt: withOpenApiSchemaDoc(z.string(), {
      title: 'PromptUpdatedAt',
      description: '版本最近更新时间，ISO 8601 字符串。',
      examples: ['2026-04-11T05:00:00.000Z'],
    }),
    version: withOpenApiSchemaDoc(z.number().int().min(1), {
      title: 'PromptVersionNumber',
      description: '同一 `promptKey` 下的递增版本号。',
      examples: [3],
    }),
  }),
  {
    title: 'PromptVersionEntry',
    description: 'Prompt 治理条目，包含版本状态、评测证据、发布门禁和回滚关系。',
    examples: [
      {
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
          scorerThresholds: {},
        },
        releaseReady: false,
        releaseReason: '缺少评测证据。',
        rolledBackFromVersionId: null,
        status: 'draft',
        updatedAt: '2026-04-11T04:00:00.000Z',
        version: 3,
      },
    ],
  },
)

export const promptVersionListInputSchema = withOpenApiSchemaDoc(
  queryPaginationSchema.extend({
    promptKey: withOpenApiSchemaDoc(promptKeySchema.optional(), {
      title: 'PromptVersionListPromptKey',
      description: '按 Prompt 治理键过滤版本列表；省略时返回全部 Prompt。',
      examples: ['admin.copilot.answer'],
    }),
    status: withOpenApiSchemaDoc(promptVersionStatusSchema.optional(), {
      title: 'PromptVersionListStatus',
      description: '按版本状态过滤；省略时返回全部状态。',
      examples: ['draft'],
    }),
  }),
  {
    title: 'PromptVersionListInput',
    description: 'Prompt 版本分页查询参数。',
    examples: [
      {
        page: 1,
        pageSize: 10,
        promptKey: 'admin.copilot.answer',
        status: 'draft',
      },
    ],
  },
)

export const promptVersionListResponseSchema = withOpenApiSchemaDoc(
  paginatedResponseSchema(promptVersionEntrySchema).extend({
    summary: withOpenApiSchemaDoc(
      z.object({
        activeCount: withOpenApiSchemaDoc(z.number().int().min(0), {
          title: 'PromptActiveCount',
          description: '当前筛选范围内的激活版本数量。',
          examples: [1],
        }),
        draftCount: withOpenApiSchemaDoc(z.number().int().min(0), {
          title: 'PromptDraftCount',
          description: '当前筛选范围内的草稿版本数量。',
          examples: [3],
        }),
        releaseReadyCount: withOpenApiSchemaDoc(z.number().int().min(0), {
          title: 'PromptReleaseReadyCount',
          description: '当前筛选范围内，已经满足发布门禁的版本数量。',
          examples: [2],
        }),
      }),
      {
        title: 'PromptVersionListSummary',
        description: 'Prompt 版本列表的附加统计摘要。',
        examples: [
          {
            activeCount: 1,
            draftCount: 3,
            releaseReadyCount: 2,
          },
        ],
      },
    ),
  }),
  {
    title: 'PromptVersionListResponse',
    description: 'Prompt 版本分页响应，返回条目列表、分页信息和治理摘要。',
    examples: [
      {
        data: [
          {
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
              scorerThresholds: {},
            },
            releaseReady: false,
            releaseReason: '缺少评测证据。',
            rolledBackFromVersionId: null,
            status: 'draft',
            updatedAt: '2026-04-11T04:00:00.000Z',
            version: 3,
          },
        ],
        pagination: {
          page: 1,
          pageSize: 10,
          total: 1,
          totalPages: 1,
        },
        summary: {
          activeCount: 1,
          draftCount: 3,
          releaseReadyCount: 2,
        },
      },
    ],
  },
)

export const createPromptVersionInputSchema = withOpenApiSchemaDoc(
  z.object({
    notes: withOpenApiSchemaDoc(z.string().trim().max(2000).optional(), {
      title: 'CreatePromptVersionNotes',
      description: '本次 Prompt 变更备注，可为空。',
      examples: ['加强财务报表解释语气。'],
    }),
    promptKey: promptKeySchema,
    promptText: withOpenApiSchemaDoc(z.string().trim().min(1), {
      title: 'CreatePromptVersionText',
      description: 'Prompt 草稿正文。',
      examples: ['你是后台管理 Copilot，请优先返回结构化结论。'],
    }),
    releasePolicy: withOpenApiSchemaDoc(
      promptReleasePolicySchema.default({
        minAverageScore: 0.8,
        scorerThresholds: {},
      }),
      {
        title: 'CreatePromptReleasePolicy',
        description: '新版本发布门禁策略；未传时使用默认阈值。',
        examples: [
          {
            minAverageScore: 0.8,
            scorerThresholds: {},
          },
        ],
        default: {
          minAverageScore: 0.8,
          scorerThresholds: {},
        },
      },
    ),
  }),
  {
    title: 'CreatePromptVersionInput',
    description: '创建新的 Prompt 草稿版本，供后续评测、激活或回滚治理流程使用。',
    examples: [
      {
        notes: '加强财务报表解释语气。',
        promptKey: 'admin.copilot.answer',
        promptText: '你是后台管理 Copilot，请优先返回结构化结论。',
        releasePolicy: {
          minAverageScore: 0.8,
          scorerThresholds: {},
        },
      },
    ],
  },
)

export const attachPromptEvalEvidenceInputSchema = withOpenApiSchemaDoc(
  z.object({
    evalRunId: withOpenApiSchemaDoc(z.string().uuid(), {
      title: 'AttachPromptEvalRunId',
      description: '要绑定到 Prompt 版本的评测运行 UUID。',
      examples: ['5b7d3be0-6f15-46ec-8ea6-3189d085f001'],
    }),
    promptVersionId: withOpenApiSchemaDoc(z.string().uuid(), {
      title: 'AttachPromptVersionId',
      description: '目标 Prompt 版本 UUID。',
      examples: ['b87ecb02-478d-40ff-b2d8-3f62fd9f9001'],
    }),
  }),
  {
    title: 'AttachPromptEvalEvidenceInput',
    description: '将一条已完成的评测运行证据绑定到指定 Prompt 版本。',
    examples: [
      {
        evalRunId: '5b7d3be0-6f15-46ec-8ea6-3189d085f001',
        promptVersionId: 'b87ecb02-478d-40ff-b2d8-3f62fd9f9001',
      },
    ],
  },
)

export const activatePromptVersionInputSchema = withOpenApiSchemaDoc(
  z.object({
    promptVersionId: withOpenApiSchemaDoc(z.string().uuid(), {
      title: 'ActivatePromptVersionId',
      description: '待激活的 Prompt 版本 UUID。',
      examples: ['b87ecb02-478d-40ff-b2d8-3f62fd9f9001'],
    }),
  }),
  {
    title: 'ActivatePromptVersionInput',
    description: '激活指定 Prompt 版本；只有满足发布门禁时才会成功。',
    examples: [
      {
        promptVersionId: 'b87ecb02-478d-40ff-b2d8-3f62fd9f9001',
      },
    ],
  },
)

export const rollbackPromptVersionInputSchema = withOpenApiSchemaDoc(
  z.object({
    promptKey: promptKeySchema,
    targetVersionId: withOpenApiSchemaDoc(z.string().uuid().optional(), {
      title: 'RollbackPromptTargetVersionId',
      description: '可选的目标历史版本 UUID；省略时回滚到最近一个可回滚版本。',
      examples: ['95f398a5-0b64-4387-8f1c-fd6476412001'],
    }),
  }),
  {
    title: 'RollbackPromptVersionInput',
    description: '按 Prompt 键回滚到指定或最近的可发布历史版本。',
    examples: [
      {
        promptKey: 'admin.copilot.answer',
        targetVersionId: '95f398a5-0b64-4387-8f1c-fd6476412001',
      },
    ],
  },
)

export type PromptVersionStatus = z.infer<typeof promptVersionStatusSchema>
export type PromptReleasePolicy = z.infer<typeof promptReleasePolicySchema>
export type PromptEvalEvidence = z.infer<typeof promptEvalEvidenceSchema>
export type PromptVersionEntry = z.infer<typeof promptVersionEntrySchema>
export type PromptVersionListInput = z.infer<typeof promptVersionListInputSchema>
export type PromptVersionListResponse = z.infer<typeof promptVersionListResponseSchema>
export type CreatePromptVersionInput = z.infer<typeof createPromptVersionInputSchema>
export type AttachPromptEvalEvidenceInput = z.infer<typeof attachPromptEvalEvidenceInputSchema>
export type ActivatePromptVersionInput = z.infer<typeof activatePromptVersionInputSchema>
export type RollbackPromptVersionInput = z.infer<typeof rollbackPromptVersionInputSchema>
