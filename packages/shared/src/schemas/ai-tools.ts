import { z } from 'zod'

import { appActions, appSubjects } from '../abilities/subjects'
import { aiFeedbackUserActionSchema } from './ai-feedback'
import { withOpenApiSchemaDoc } from './openapi-doc'

export const aiToolPermissionSchema = withOpenApiSchemaDoc(
  z.object({
    action: withOpenApiSchemaDoc(z.enum(appActions), {
      title: 'AiToolPermissionAction',
      description: '调用当前 AI Tool 所要求的动作权限。',
      examples: ['read'],
    }),
    subject: withOpenApiSchemaDoc(z.enum(appSubjects), {
      title: 'AiToolPermissionSubject',
      description: '调用当前 AI Tool 所要求的资源主体。',
      examples: ['User'],
    }),
  }),
  {
    title: 'AiToolPermission',
    description: 'AI Tool 对应的最小 RBAC 权限要求。',
    examples: [
      {
        action: 'read',
        subject: 'User',
      },
    ],
  },
)

export const aiToolCatalogItemSchema = z.object({
  description: withOpenApiSchemaDoc(z.string(), {
    title: 'AiToolCatalogItemDescription',
    description: 'Tool 的用途说明。',
    examples: ['查询后台用户目录，并返回受权限约束的结果。'],
  }),
  enabled: withOpenApiSchemaDoc(z.boolean(), {
    title: 'AiToolCatalogItemEnabled',
    description: '当前主体在本次请求上下文中是否可用该 Tool。',
    examples: [true],
  }),
  id: withOpenApiSchemaDoc(z.string(), {
    title: 'AiToolCatalogItemId',
    description: 'Tool 唯一标识符。',
    examples: ['tool_user_directory'],
  }),
  permission: aiToolPermissionSchema,
})

export const aiToolCatalogResponseSchema = withOpenApiSchemaDoc(
  z.object({
    tools: withOpenApiSchemaDoc(z.array(aiToolCatalogItemSchema), {
      title: 'AiToolCatalogItems',
      description: '当前运行时已注册的 Tool 列表及其 RBAC 可用性。',
      examples: [
        [
          {
            description: '查询后台用户目录，并返回受权限约束的结果。',
            enabled: true,
            id: 'tool_user_directory',
            permission: {
              action: 'read',
              subject: 'User',
            },
          },
        ],
      ],
    }),
  }),
  {
    title: 'AiToolCatalogResponse',
    description: 'AI Tool 目录响应，供后台管理页判断当前主体可见的 Tool 能力。',
    examples: [
      {
        tools: [
          {
            description: '查询后台用户目录，并返回受权限约束的结果。',
            enabled: true,
            id: 'tool_user_directory',
            permission: {
              action: 'read',
              subject: 'User',
            },
          },
        ],
      },
    ],
  },
)

export const aiAuditLogEntrySchema = withOpenApiSchemaDoc(
  z.object({
    action: withOpenApiSchemaDoc(z.enum(appActions), {
      title: 'AiAuditAction',
      description: '本次 AI 审计记录对应的业务动作。',
      examples: ['read'],
    }),
    actorAuthUserId: withOpenApiSchemaDoc(z.string(), {
      title: 'AiAuditActorAuthUserId',
      description: '触发本次 AI 调用的 Better Auth 主体 ID。',
      examples: ['auth_user_01'],
    }),
    actorRbacUserId: withOpenApiSchemaDoc(z.string().uuid().nullable(), {
      title: 'AiAuditActorRbacUserId',
      description: '触发本次 AI 调用的应用内 RBAC 用户 ID；未映射时为 `null`。',
      examples: ['8c8d0f66-c9db-4c4e-9d82-f1c70d6ef001'],
    }),
    createdAt: withOpenApiSchemaDoc(z.string(), {
      title: 'AiAuditCreatedAt',
      description: '审计记录创建时间，ISO 8601 字符串。',
      examples: ['2026-04-11T03:00:00.000Z'],
    }),
    errorMessage: withOpenApiSchemaDoc(z.string().nullable(), {
      title: 'AiAuditErrorMessage',
      description: 'Tool 或 Agent 执行失败时的错误消息；成功时为 `null`。',
      examples: [null],
    }),
    feedbackCount: withOpenApiSchemaDoc(z.number().int().min(0), {
      title: 'AiAuditFeedbackCount',
      description: '关联到当前审计记录的反馈数量。',
      examples: [2],
    }),
    humanOverride: withOpenApiSchemaDoc(z.boolean(), {
      title: 'AiAuditHumanOverride',
      description: '是否发生过人工接管或覆盖。',
      examples: [false],
    }),
    id: withOpenApiSchemaDoc(z.string().uuid(), {
      title: 'AiAuditLogId',
      description: 'AI 审计日志主键 UUID。',
      examples: ['f2c4f471-0f3a-4b6d-9d7a-31968e812001'],
    }),
    latestFeedbackAt: withOpenApiSchemaDoc(z.string().nullable(), {
      title: 'AiAuditLatestFeedbackAt',
      description: '最近一次反馈时间；没有反馈时为 `null`。',
      examples: ['2026-04-11T03:15:00.000Z'],
    }),
    latestUserAction: withOpenApiSchemaDoc(aiFeedbackUserActionSchema.nullable(), {
      title: 'AiAuditLatestUserAction',
      description: '最近一次反馈对应的用户动作；没有反馈时为 `null`。',
      examples: ['overridden'],
    }),
    requestId: withOpenApiSchemaDoc(z.string().nullable(), {
      title: 'AiAuditRequestId',
      description: '关联请求 ID，用于串联 API、Tool 与日志排障链路。',
      examples: ['req_01'],
    }),
    roleCodes: withOpenApiSchemaDoc(z.array(z.string()), {
      title: 'AiAuditRoleCodes',
      description: '触发主体在当前调用时持有的角色编码快照。',
      examples: [['super_admin']],
    }),
    status: withOpenApiSchemaDoc(z.enum(['error', 'forbidden', 'success']), {
      title: 'AiAuditStatus',
      description: 'AI 调用执行结果状态。',
      examples: ['success', 'forbidden', 'error'],
    }),
    subject: withOpenApiSchemaDoc(z.enum(appSubjects), {
      title: 'AiAuditSubject',
      description: '本次 AI 调用触达的业务资源主体。',
      examples: ['User'],
    }),
    toolId: withOpenApiSchemaDoc(z.string(), {
      title: 'AiAuditToolId',
      description: '被调用的 Tool 标识符。',
      examples: ['tool_user_directory'],
    }),
  }),
  {
    title: 'AiAuditLogEntry',
    description: '单条 AI 审计日志，记录 Tool 调用结果、主体身份、反馈汇总和权限上下文。',
    examples: [
      {
        action: 'read',
        actorAuthUserId: 'auth_user_01',
        actorRbacUserId: '8c8d0f66-c9db-4c4e-9d82-f1c70d6ef001',
        createdAt: '2026-04-11T03:00:00.000Z',
        errorMessage: null,
        feedbackCount: 2,
        humanOverride: false,
        id: 'f2c4f471-0f3a-4b6d-9d7a-31968e812001',
        latestFeedbackAt: '2026-04-11T03:15:00.000Z',
        latestUserAction: 'accepted',
        requestId: 'req_01',
        roleCodes: ['super_admin'],
        status: 'success',
        subject: 'User',
        toolId: 'tool_user_directory',
      },
    ],
  },
)

export const aiAuditLogListResponseSchema = withOpenApiSchemaDoc(
  z.object({
    logs: withOpenApiSchemaDoc(z.array(aiAuditLogEntrySchema), {
      title: 'AiAuditLogListItems',
      description: '最近 AI 审计日志列表。',
      examples: [
        [
          {
            action: 'read',
            actorAuthUserId: 'auth_user_01',
            actorRbacUserId: '8c8d0f66-c9db-4c4e-9d82-f1c70d6ef001',
            createdAt: '2026-04-11T03:00:00.000Z',
            errorMessage: null,
            feedbackCount: 2,
            humanOverride: false,
            id: 'f2c4f471-0f3a-4b6d-9d7a-31968e812001',
            latestFeedbackAt: '2026-04-11T03:15:00.000Z',
            latestUserAction: 'accepted',
            requestId: 'req_01',
            roleCodes: ['super_admin'],
            status: 'success',
            subject: 'User',
            toolId: 'tool_user_directory',
          },
        ],
      ],
    }),
  }),
  {
    title: 'AiAuditLogListResponse',
    description: '最近 AI 审计日志响应，用于 system 辅助入口的快速概览。',
    examples: [
      {
        logs: [
          {
            action: 'read',
            actorAuthUserId: 'auth_user_01',
            actorRbacUserId: '8c8d0f66-c9db-4c4e-9d82-f1c70d6ef001',
            createdAt: '2026-04-11T03:00:00.000Z',
            errorMessage: null,
            feedbackCount: 2,
            humanOverride: false,
            id: 'f2c4f471-0f3a-4b6d-9d7a-31968e812001',
            latestFeedbackAt: '2026-04-11T03:15:00.000Z',
            latestUserAction: 'accepted',
            requestId: 'req_01',
            roleCodes: ['super_admin'],
            status: 'success',
            subject: 'User',
            toolId: 'tool_user_directory',
          },
        ],
      },
    ],
  },
)
