import { z } from 'zod'

import { withOpenApiSchemaDoc } from './openapi-doc'

export const aiFeedbackUserActionSchema = withOpenApiSchemaDoc(
  z.enum(['accepted', 'edited', 'overridden', 'rejected']),
  {
    title: 'AiFeedbackUserAction',
    description: '用户对 AI 输出采取的最终动作，分别表示采纳、编辑后采纳、人工接管覆盖或直接拒绝。',
    examples: ['accepted', 'edited', 'overridden', 'rejected'],
  },
)

export const createAiFeedbackInputSchema = withOpenApiSchemaDoc(
  z
    .object({
      accepted: withOpenApiSchemaDoc(z.boolean(), {
        title: 'AiFeedbackAccepted',
        description:
          'AI 建议是否被最终采纳；只有 `accepted` 动作允许为 `true`，其余动作必须为 `false`。',
        examples: [true, false],
      }),
      auditLogId: withOpenApiSchemaDoc(z.string().uuid(), {
        title: 'AiAuditLogId',
        description: '目标 AI 审计日志主键 UUID，用于把反馈绑定到一次具体的 Tool 或 Agent 调用。',
        examples: ['f2c4f471-0f3a-4b6d-9d7a-31968e812001'],
      }),
      correction: withOpenApiSchemaDoc(z.string().trim().max(2_000).optional(), {
        title: 'AiFeedbackCorrection',
        description:
          '人工修正文案；当 `userAction` 为 `edited` 或 `overridden` 时必填，用于记录人工替代结果。',
        examples: ['请改为仅导出财务部用户，并隐藏手机号字段。'],
      }),
      feedbackText: withOpenApiSchemaDoc(z.string().trim().max(2_000).optional(), {
        title: 'AiFeedbackText',
        description: '用户对本次 AI 输出的自由文本反馈，可为空。',
        examples: ['结果基本正确，但需要补充审批说明。'],
      }),
      userAction: aiFeedbackUserActionSchema,
    })
    .superRefine((value, context) => {
      const normalizedCorrection = value.correction?.trim()

      if (value.userAction === 'accepted' && !value.accepted) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'accepted feedback must set accepted=true',
          path: ['accepted'],
        })
      }

      if (value.userAction !== 'accepted' && value.accepted) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'non-accepted feedback must set accepted=false',
          path: ['accepted'],
        })
      }

      if (
        (value.userAction === 'edited' || value.userAction === 'overridden') &&
        !normalizedCorrection
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'edited or overridden feedback requires a correction',
          path: ['correction'],
        })
      }
    }),
  {
    title: 'CreateAiFeedbackInput',
    description: '提交一次 AI 反馈或人工接管结果，并绑定到指定 AI 审计日志。',
    examples: [
      {
        accepted: false,
        auditLogId: 'f2c4f471-0f3a-4b6d-9d7a-31968e812001',
        correction: '请改为仅导出财务部用户，并隐藏手机号字段。',
        feedbackText: '原始导出范围过大。',
        userAction: 'overridden',
      },
    ],
  },
)

export const aiFeedbackEntrySchema = withOpenApiSchemaDoc(
  z.object({
    accepted: withOpenApiSchemaDoc(z.boolean(), {
      title: 'AiFeedbackEntryAccepted',
      description: '反馈结果是否表示最终采纳 AI 输出。',
      examples: [false],
    }),
    actorAuthUserId: withOpenApiSchemaDoc(z.string(), {
      title: 'AiFeedbackActorAuthUserId',
      description: 'Better Auth 主体 ID，用于标识提交反馈的登录主体。',
      examples: ['auth_user_01'],
    }),
    actorRbacUserId: withOpenApiSchemaDoc(z.string().uuid().nullable(), {
      title: 'AiFeedbackActorRbacUserId',
      description: '应用内 RBAC 用户 ID；匿名或未映射时为 `null`。',
      examples: ['8c8d0f66-c9db-4c4e-9d82-f1c70d6ef001'],
    }),
    auditLogId: withOpenApiSchemaDoc(z.string().uuid(), {
      title: 'AiFeedbackEntryAuditLogId',
      description: '被反馈的 AI 审计日志 ID。',
      examples: ['f2c4f471-0f3a-4b6d-9d7a-31968e812001'],
    }),
    correction: withOpenApiSchemaDoc(z.string().nullable(), {
      title: 'AiFeedbackEntryCorrection',
      description: '人工修正文案；未编辑或未人工接管时为 `null`。',
      examples: ['请改为仅导出财务部用户，并隐藏手机号字段。'],
    }),
    createdAt: withOpenApiSchemaDoc(z.string(), {
      title: 'AiFeedbackCreatedAt',
      description: '反馈创建时间，ISO 8601 字符串。',
      examples: ['2026-04-11T02:30:00.000Z'],
    }),
    feedbackText: withOpenApiSchemaDoc(z.string().nullable(), {
      title: 'AiFeedbackEntryText',
      description: '用户填写的原始反馈文本；未填写时为 `null`。',
      examples: ['原始导出范围过大。'],
    }),
    id: withOpenApiSchemaDoc(z.string().uuid(), {
      title: 'AiFeedbackId',
      description: 'AI 反馈记录主键 UUID。',
      examples: ['e476f380-9504-42fb-9f5b-d5ed214df001'],
    }),
    userAction: aiFeedbackUserActionSchema,
  }),
  {
    title: 'AiFeedbackEntry',
    description: '一条 AI 反馈或人工接管记录，用于回放用户对 AI 输出的最终处理动作。',
    examples: [
      {
        accepted: false,
        actorAuthUserId: 'auth_user_01',
        actorRbacUserId: '8c8d0f66-c9db-4c4e-9d82-f1c70d6ef001',
        auditLogId: 'f2c4f471-0f3a-4b6d-9d7a-31968e812001',
        correction: '请改为仅导出财务部用户，并隐藏手机号字段。',
        createdAt: '2026-04-11T02:30:00.000Z',
        feedbackText: '原始导出范围过大。',
        id: 'e476f380-9504-42fb-9f5b-d5ed214df001',
        userAction: 'overridden',
      },
    ],
  },
)

export const aiFeedbackSummarySchema = withOpenApiSchemaDoc(
  z.object({
    accepted: withOpenApiSchemaDoc(z.number().int().min(0), {
      title: 'AiFeedbackAcceptedCount',
      description: '当前筛选范围内，被最终采纳的反馈数量。',
      examples: [4],
    }),
    edited: withOpenApiSchemaDoc(z.number().int().min(0), {
      title: 'AiFeedbackEditedCount',
      description: '当前筛选范围内，用户编辑后采纳的反馈数量。',
      examples: [2],
    }),
    humanOverrideCount: withOpenApiSchemaDoc(z.number().int().min(0), {
      title: 'AiFeedbackHumanOverrideCount',
      description: '当前筛选范围内，发生人工接管的总次数。',
      examples: [1],
    }),
    overridden: withOpenApiSchemaDoc(z.number().int().min(0), {
      title: 'AiFeedbackOverriddenCount',
      description: '当前筛选范围内，用户完全覆盖 AI 结果的反馈数量。',
      examples: [1],
    }),
    rejected: withOpenApiSchemaDoc(z.number().int().min(0), {
      title: 'AiFeedbackRejectedCount',
      description: '当前筛选范围内，直接拒绝 AI 建议的反馈数量。',
      examples: [3],
    }),
  }),
  {
    title: 'AiFeedbackSummary',
    description: 'AI 反馈列表附带的汇总统计，用于仪表盘展示人工采纳与接管趋势。',
    examples: [
      {
        accepted: 4,
        edited: 2,
        humanOverrideCount: 1,
        overridden: 1,
        rejected: 3,
      },
    ],
  },
)

export type AiFeedbackUserAction = z.infer<typeof aiFeedbackUserActionSchema>
export type AiFeedbackCreateInput = z.infer<typeof createAiFeedbackInputSchema>
export type AiFeedbackEntry = z.infer<typeof aiFeedbackEntrySchema>
