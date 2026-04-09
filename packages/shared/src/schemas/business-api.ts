import { z } from 'zod'

import { appActions, appSubjects } from '../abilities/subjects'
import { aiEvalRunStatusSchema } from './ai-evals'
import {
  aiFeedbackEntrySchema,
  aiFeedbackSummarySchema,
  aiFeedbackUserActionSchema,
} from './ai-feedback'
import { aiKnowledgeMetadataSchema } from './ai-knowledge'
import { aiAuditLogEntrySchema } from './ai-tools'
import { paginatedResponseSchema } from './common'
import { dependencyHealthStatusSchema, telemetryHealthSchema } from './health'
import { withOpenApiSchemaDoc } from './openapi-doc'

const queryPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
})

const booleanQuerySchema = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((value) => (typeof value === 'boolean' ? value : value === 'true'))

const baseSearchSchema = queryPaginationSchema.extend({
  search: z.string().trim().min(1).max(100).optional(),
})

const userIdSchema = withOpenApiSchemaDoc(z.string().uuid(), {
  title: 'UserId',
  description: '应用用户主键 UUID，用于定位单个后台用户主体。',
  examples: ['4f6f2db4-2b4e-4b9f-b9f2-3f4b81f7d001'],
})

const usernameFieldSchema = withOpenApiSchemaDoc(z.string().trim().min(3).max(50), {
  title: 'Username',
  description: '系统内唯一用户名，用于后台用户标识与目录检索，不直接替代邮箱登录。',
  examples: ['alice_admin'],
})

const emailFieldSchema = withOpenApiSchemaDoc(z.string().trim().email(), {
  title: 'UserEmail',
  description: '登录邮箱，必须唯一；创建或更新时会同步到 Better Auth 主体。',
  examples: ['alice@example.com'],
})

const userStatusFieldSchema = withOpenApiSchemaDoc(z.boolean(), {
  title: 'UserStatus',
  description: '用户启用状态，`true` 表示启用，`false` 表示停用。',
  examples: [true],
  default: true,
})

export const listUsersInputSchema = withOpenApiSchemaDoc(
  baseSearchSchema.extend({
    status: withOpenApiSchemaDoc(booleanQuerySchema.optional(), {
      title: 'UserStatusFilter',
      description: '按启用状态过滤用户；省略时返回全部状态。',
      examples: [true],
    }),
  }),
  {
    title: 'ListUsersInput',
    description: '用户目录分页查询参数，支持按用户名/邮箱关键词与启停状态筛选。',
    examples: [
      {
        page: 1,
        pageSize: 10,
        search: 'alice',
        status: true,
      },
    ],
  },
)

const roleCodeSchema = withOpenApiSchemaDoc(z.string().trim().min(1).max(50), {
  title: 'RoleCode',
  description: 'RBAC 角色编码，必须对应一个已激活角色，例如 `admin` 或 `viewer`。',
  examples: ['admin'],
})

const nullableNicknameSchema = withOpenApiSchemaDoc(
  z.preprocess((value) => {
    if (typeof value !== 'string') {
      return value
    }

    const trimmedValue = value.trim()

    return trimmedValue.length === 0 ? null : trimmedValue
  }, z.string().trim().min(1).max(50).nullable()),
  {
    title: 'UserNickname',
    description: '用户昵称，可为空字符串；空字符串会在入库前归一化为 `null`。',
    examples: ['Alice'],
  },
)

const requiredPasswordSchema = withOpenApiSchemaDoc(z.string().min(12).max(100), {
  title: 'UserPassword',
  description: '初始登录密码，最少 12 位；仅在创建用户或显式重置密码时使用，不会在任何响应中返回。',
  examples: ['Passw0rd!Passw0rd!'],
})

const optionalPasswordSchema = withOpenApiSchemaDoc(
  z.preprocess((value) => {
    if (typeof value !== 'string') {
      return value
    }

    const trimmedValue = value.trim()

    return trimmedValue.length === 0 ? undefined : trimmedValue
  }, z.string().min(12).max(100).optional()),
  {
    title: 'OptionalUserPassword',
    description: '可选密码重置字段；留空表示不重置 Better Auth credential，填写时会更新登录密码。',
    examples: ['Passw0rd!Passw0rd!'],
  },
)

const roleCodesFieldSchema = withOpenApiSchemaDoc(z.array(roleCodeSchema).max(10).default([]), {
  title: 'UserRoleCodes',
  description: '用户绑定的角色编码列表，最多 10 个；后端会校验这些角色必须存在且处于激活状态。',
  examples: [['admin'], ['viewer', 'editor']],
  default: [],
})

export const userListItemSchema = withOpenApiSchemaDoc(
  z.object({
    createdAt: withOpenApiSchemaDoc(z.string(), {
      title: 'UserCreatedAt',
      description: '用户创建时间，ISO 8601 字符串。',
      examples: ['2026-04-09T09:30:00.000Z'],
    }),
    email: emailFieldSchema,
    id: userIdSchema,
    nickname: withOpenApiSchemaDoc(z.string().nullable(), {
      title: 'UserNicknameNullable',
      description: '用户昵称；未设置时为 `null`。',
      examples: ['Alice'],
    }),
    roleCodes: withOpenApiSchemaDoc(z.array(z.string()), {
      title: 'ResolvedUserRoleCodes',
      description: '当前用户已绑定的角色编码列表，按稳定顺序返回。',
      examples: [['admin']],
    }),
    status: userStatusFieldSchema,
    updatedAt: withOpenApiSchemaDoc(z.string(), {
      title: 'UserUpdatedAt',
      description: '用户最近一次更新时间，ISO 8601 字符串。',
      examples: ['2026-04-09T10:00:00.000Z'],
    }),
    username: usernameFieldSchema,
  }),
  {
    title: 'UserEntry',
    description: '后台用户目录条目，包含应用用户基础信息与当前归一化后的 RBAC 角色编码。',
    examples: [
      {
        id: '4f6f2db4-2b4e-4b9f-b9f2-3f4b81f7d001',
        username: 'alice_admin',
        email: 'alice@example.com',
        nickname: 'Alice',
        roleCodes: ['admin'],
        status: true,
        createdAt: '2026-04-09T09:30:00.000Z',
        updatedAt: '2026-04-09T10:00:00.000Z',
      },
    ],
  },
)

export const userEntrySchema = userListItemSchema

export const userListResponseSchema = withOpenApiSchemaDoc(
  paginatedResponseSchema(userListItemSchema),
  {
    title: 'UserListResponse',
    description: '用户目录分页响应，返回当前页数据与标准分页信息。',
    examples: [
      {
        data: [
          {
            id: '4f6f2db4-2b4e-4b9f-b9f2-3f4b81f7d001',
            username: 'alice_admin',
            email: 'alice@example.com',
            nickname: 'Alice',
            roleCodes: ['admin'],
            status: true,
            createdAt: '2026-04-09T09:30:00.000Z',
            updatedAt: '2026-04-09T10:00:00.000Z',
          },
        ],
        pagination: {
          page: 1,
          pageSize: 10,
          total: 1,
          totalPages: 1,
        },
      },
    ],
  },
)

export const getUserByIdInputSchema = withOpenApiSchemaDoc(
  z.object({
    id: userIdSchema,
  }),
  {
    title: 'GetUserByIdInput',
    description: '按用户 UUID 读取单个后台用户主体详情。',
    examples: [
      {
        id: '4f6f2db4-2b4e-4b9f-b9f2-3f4b81f7d001',
      },
    ],
  },
)

export const createUserInputSchema = withOpenApiSchemaDoc(
  z.object({
    email: emailFieldSchema,
    nickname: withOpenApiSchemaDoc(nullableNicknameSchema.default(null), {
      title: 'CreateUserNickname',
      description: '用户昵称，未填写时默认写入 `null`。',
      examples: ['Alice'],
      default: null,
    }),
    password: requiredPasswordSchema,
    roleCodes: roleCodesFieldSchema,
    status: withOpenApiSchemaDoc(userStatusFieldSchema.default(true), {
      title: 'CreateUserStatus',
      description: '创建后是否立即启用；默认 `true`。',
      examples: [true],
      default: true,
    }),
    username: usernameFieldSchema,
  }),
  {
    title: 'CreateUserInput',
    description:
      '创建后台用户主体，请求会同时写入应用用户表、Better Auth 凭证主体以及 RBAC 角色绑定。',
    examples: [
      {
        username: 'alice_admin',
        email: 'alice@example.com',
        nickname: 'Alice',
        password: 'Passw0rd!Passw0rd!',
        roleCodes: ['admin'],
        status: true,
      },
    ],
  },
)

export const updateUserInputSchema = withOpenApiSchemaDoc(
  z.object({
    email: emailFieldSchema,
    id: userIdSchema,
    nickname: withOpenApiSchemaDoc(nullableNicknameSchema.default(null), {
      title: 'UpdateUserNickname',
      description: '更新后的用户昵称，空字符串会归一化为 `null`。',
      examples: ['Alice Ops'],
      default: null,
    }),
    password: optionalPasswordSchema,
    roleCodes: roleCodesFieldSchema,
    status: userStatusFieldSchema,
    username: usernameFieldSchema,
  }),
  {
    title: 'UpdateUserInput',
    description:
      '更新后台用户主体与 RBAC 角色绑定；如提供 `password`，还会同步重置 Better Auth credential。',
    examples: [
      {
        id: '4f6f2db4-2b4e-4b9f-b9f2-3f4b81f7d001',
        username: 'alice_admin',
        email: 'alice@example.com',
        nickname: 'Alice Ops',
        roleCodes: ['editor'],
        status: true,
      },
    ],
  },
)

export const deleteUserInputSchema = withOpenApiSchemaDoc(
  z.object({
    id: userIdSchema,
  }),
  {
    title: 'DeleteUserInput',
    description: '删除后台用户主体的请求参数，按 UUID 指定目标用户。',
    examples: [
      {
        id: '4f6f2db4-2b4e-4b9f-b9f2-3f4b81f7d001',
      },
    ],
  },
)

export const deleteUserResultSchema = withOpenApiSchemaDoc(
  z.object({
    deleted: withOpenApiSchemaDoc(z.literal(true), {
      title: 'DeleteUserSuccessFlag',
      description: '删除成功标志，固定为 `true`。',
      examples: [true],
    }),
    id: userIdSchema,
  }),
  {
    title: 'DeleteUserResult',
    description: '用户删除成功后的标准响应。',
    examples: [
      {
        deleted: true,
        id: '4f6f2db4-2b4e-4b9f-b9f2-3f4b81f7d001',
      },
    ],
  },
)

export const listRolesInputSchema = baseSearchSchema.extend({
  status: booleanQuerySchema.optional(),
})

export const roleListItemSchema = z.object({
  code: z.string(),
  createdAt: z.string(),
  description: z.string().nullable(),
  id: z.string().uuid(),
  name: z.string(),
  permissionCount: z.number().int().min(0),
  sortOrder: z.number().int(),
  status: z.boolean(),
  updatedAt: z.string(),
  userCount: z.number().int().min(0),
})

export const roleListResponseSchema = paginatedResponseSchema(roleListItemSchema)

export const listPermissionsInputSchema = baseSearchSchema.extend({
  action: z.enum(appActions).optional(),
  resource: z.enum(appSubjects).optional(),
})

export const permissionListItemSchema = z.object({
  action: z.enum(appActions),
  conditions: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
  description: z.string().nullable(),
  fields: z.array(z.string()).nullable(),
  id: z.string().uuid(),
  inverted: z.boolean(),
  resource: z.enum(appSubjects),
})

export const permissionListResponseSchema = paginatedResponseSchema(permissionListItemSchema)

export const listMenusInputSchema = baseSearchSchema.extend({
  status: booleanQuerySchema.optional(),
  visible: booleanQuerySchema.optional(),
})

export const menuListItemSchema = z.object({
  component: z.string().nullable(),
  createdAt: z.string(),
  icon: z.string().nullable(),
  id: z.string().uuid(),
  name: z.string(),
  parentId: z.string().uuid().nullable(),
  path: z.string().nullable(),
  permissionAction: z.enum(appActions).nullable(),
  permissionResource: z.enum(appSubjects).nullable(),
  sortOrder: z.number().int(),
  status: z.boolean(),
  type: z.string(),
  visible: z.boolean(),
})

export const menuListResponseSchema = paginatedResponseSchema(menuListItemSchema)

// 系统字典 contract-first skeleton。
export const dictEntrySchema = z.object({
  label: z.string(),
  sortOrder: z.number().int().min(0),
  value: z.string(),
})

export const listDictsInputSchema = baseSearchSchema
  .extend({
    source: z.enum(['runtime', 'seed']).optional(),
    status: booleanQuerySchema.optional(),
  })
  .default({
    page: 1,
    pageSize: 10,
  })

export const dictListItemSchema = z.object({
  code: z.string(),
  createdAt: z.string(),
  description: z.string().nullable(),
  entries: z.array(dictEntrySchema),
  entryCount: z.number().int().min(0),
  id: z.string(),
  name: z.string(),
  source: z.enum(['runtime', 'seed']),
  status: z.boolean(),
  updatedAt: z.string(),
})

export const dictListResponseSchema = paginatedResponseSchema(dictListItemSchema)

// 系统配置 contract-first skeleton。
export const configScopeSchema = z.enum(['ai', 'application', 'deploy', 'security'])

export const listConfigsInputSchema = baseSearchSchema
  .extend({
    scope: configScopeSchema.optional(),
  })
  .default({
    page: 1,
    pageSize: 10,
  })

export const configListItemSchema = z.object({
  description: z.string(),
  key: z.string(),
  mutable: z.boolean(),
  scope: configScopeSchema,
  source: z.enum(['env', 'runtime', 'static']),
  updatedAt: z.string(),
  value: z.string(),
})

export const configListResponseSchema = paginatedResponseSchema(configListItemSchema)

export const listOperationLogsInputSchema = baseSearchSchema.extend({
  module: z.string().trim().min(1).max(100).optional(),
  status: z.enum(['error', 'success']).optional(),
})

export const operationLogListItemSchema = z.object({
  action: z.string(),
  createdAt: z.string(),
  detail: z.string(),
  errorMessage: z.string().nullable(),
  id: z.string().uuid(),
  module: z.string(),
  operatorId: z.string().uuid(),
  requestId: z.string().nullable(),
  status: z.string(),
  targetId: z.string().uuid().nullable(),
})

export const operationLogListResponseSchema = paginatedResponseSchema(operationLogListItemSchema)

export const listOnlineUsersInputSchema = baseSearchSchema

export const onlineUserListItemSchema = z.object({
  createdAt: z.string(),
  email: z.string().email(),
  expiresAt: z.string(),
  ipAddress: z.string().nullable(),
  name: z.string(),
  rbacUserId: z.string().uuid().nullable(),
  roleCodes: z.array(z.string()),
  sessionId: z.string(),
  userAgent: z.string().nullable(),
  userId: z.string(),
})

export const onlineUserListResponseSchema = paginatedResponseSchema(onlineUserListItemSchema)

export const serverSummarySchema = z.object({
  environment: z.object({
    nodeEnv: z.string(),
    port: z.number().int(),
  }),
  health: z.object({
    api: z.literal('ok'),
    database: dependencyHealthStatusSchema,
    redis: dependencyHealthStatusSchema,
    status: z.enum(['degraded', 'ok']),
    telemetry: telemetryHealthSchema,
  }),
  runtime: z.object({
    agentCount: z.number().int().min(0),
    runtimeStage: z.enum(['agents_ready', 'tools_only', 'workflows_ready']),
    toolCount: z.number().int().min(0),
    workflowCount: z.number().int().min(0),
  }),
})

export const listKnowledgeInputSchema = baseSearchSchema.extend({
  sourceType: z.string().trim().min(1).max(50).optional(),
})

export const knowledgeListItemSchema = z.object({
  chunkCount: z.number().int().min(0),
  documentId: z.string().uuid(),
  lastIndexedAt: z.string(),
  metadata: aiKnowledgeMetadataSchema,
  sourceType: z.string(),
  sourceUri: z.string().nullable(),
  title: z.string(),
})

export const knowledgeListResponseSchema = paginatedResponseSchema(knowledgeListItemSchema)

export const listAiAuditLogsInputSchema = queryPaginationSchema.extend({
  status: z.enum(['error', 'forbidden', 'success']).optional(),
  toolId: z.string().trim().min(1).max(100).optional(),
})

export const aiAuditListResponseSchema = paginatedResponseSchema(aiAuditLogEntrySchema)

export const listAiFeedbackInputSchema = queryPaginationSchema.extend({
  accepted: booleanQuerySchema.optional(),
  auditLogId: z.string().uuid().optional(),
  search: z.string().trim().min(1).max(100).optional(),
  userAction: aiFeedbackUserActionSchema.optional(),
})

export const aiFeedbackListResponseSchema = paginatedResponseSchema(aiFeedbackEntrySchema).extend({
  summary: aiFeedbackSummarySchema,
})

export const listAiEvalsInputSchema = queryPaginationSchema

export const aiEvalListItemSchema = z.object({
  backing: z.literal('mastra'),
  datasetSize: z.number().int().min(0),
  id: z.string(),
  lastRunAverageScore: z.number().min(0).max(1).nullable(),
  lastRunAt: z.string().nullable(),
  lastRunStatus: aiEvalRunStatusSchema.nullable(),
  name: z.string(),
  notes: z.string(),
  scorerCount: z.number().int().min(0),
  status: z.enum(['not_configured', 'registered']),
})

export const aiEvalListResponseSchema = paginatedResponseSchema(aiEvalListItemSchema).extend({
  summary: z.object({
    configured: z.boolean(),
    reason: z.string(),
    totalDatasets: z.number().int().min(0),
    totalExperiments: z.number().int().min(0),
  }),
})

// 工具发现 contract-first skeleton。
export const toolGenKindSchema = z.enum(['agent', 'copilot', 'prompt'])
export const toolGenStatusSchema = z.enum(['available', 'planned'])

export const listToolGenInputSchema = baseSearchSchema
  .extend({
    kind: toolGenKindSchema.optional(),
    status: toolGenStatusSchema.optional(),
  })
  .default({
    page: 1,
    pageSize: 10,
  })

export const toolGenListItemSchema = z.object({
  backing: z.enum(['copilotkit', 'mastra-agent', 'prompt-governance']),
  description: z.string(),
  id: z.string(),
  kind: toolGenKindSchema,
  name: z.string(),
  routePath: z.string().nullable(),
  status: toolGenStatusSchema,
})

export const toolGenListResponseSchema = paginatedResponseSchema(toolGenListItemSchema).extend({
  summary: z.object({
    availableCount: z.number().int().min(0),
    plannedCount: z.number().int().min(0),
  }),
})

export const toolJobModeSchema = z.enum(['manual', 'scheduled'])

export const listToolJobsInputSchema = baseSearchSchema
  .extend({
    mode: toolJobModeSchema.optional(),
  })
  .default({
    page: 1,
    pageSize: 10,
  })

export const toolJobListItemSchema = z.object({
  description: z.string(),
  id: z.string(),
  mode: toolJobModeSchema,
  name: z.string(),
  schedule: z.string().nullable(),
  status: z.enum(['registered', 'scheduled']),
  triggerConfigPath: z.string(),
  workflowId: z.string().nullable(),
})

export const toolJobsListResponseSchema = paginatedResponseSchema(toolJobListItemSchema).extend({
  summary: z.object({
    registeredCount: z.number().int().min(0),
    scheduledCount: z.number().int().min(0),
    workflowLinkedCount: z.number().int().min(0),
  }),
})

export type ListUsersInput = z.infer<typeof listUsersInputSchema>
export type GetUserByIdInput = z.infer<typeof getUserByIdInputSchema>
export type CreateUserInput = z.infer<typeof createUserInputSchema>
export type UpdateUserInput = z.infer<typeof updateUserInputSchema>
export type DeleteUserInput = z.infer<typeof deleteUserInputSchema>
export type UserEntry = z.infer<typeof userEntrySchema>
export type UserListResponse = z.infer<typeof userListResponseSchema>
export type DeleteUserResult = z.infer<typeof deleteUserResultSchema>
export type ListRolesInput = z.infer<typeof listRolesInputSchema>
export type RoleListResponse = z.infer<typeof roleListResponseSchema>
export type ListPermissionsInput = z.infer<typeof listPermissionsInputSchema>
export type PermissionListResponse = z.infer<typeof permissionListResponseSchema>
export type ListMenusInput = z.infer<typeof listMenusInputSchema>
export type MenuListResponse = z.infer<typeof menuListResponseSchema>
export type ListDictsInput = z.infer<typeof listDictsInputSchema>
export type DictListResponse = z.infer<typeof dictListResponseSchema>
export type ListConfigsInput = z.infer<typeof listConfigsInputSchema>
export type ConfigListResponse = z.infer<typeof configListResponseSchema>
export type ListOperationLogsInput = z.infer<typeof listOperationLogsInputSchema>
export type OperationLogListResponse = z.infer<typeof operationLogListResponseSchema>
export type ListOnlineUsersInput = z.infer<typeof listOnlineUsersInputSchema>
export type OnlineUserListResponse = z.infer<typeof onlineUserListResponseSchema>
export type ServerSummary = z.infer<typeof serverSummarySchema>
export type ListKnowledgeInput = z.infer<typeof listKnowledgeInputSchema>
export type KnowledgeListResponse = z.infer<typeof knowledgeListResponseSchema>
export type ListAiAuditLogsInput = z.infer<typeof listAiAuditLogsInputSchema>
export type AiAuditListResponse = z.infer<typeof aiAuditListResponseSchema>
export type ListAiFeedbackInput = z.infer<typeof listAiFeedbackInputSchema>
export type AiFeedbackListResponse = z.infer<typeof aiFeedbackListResponseSchema>
export type ListAiEvalsInput = z.infer<typeof listAiEvalsInputSchema>
export type AiEvalListResponse = z.infer<typeof aiEvalListResponseSchema>
export type ListToolGenInput = z.infer<typeof listToolGenInputSchema>
export type ToolGenListResponse = z.infer<typeof toolGenListResponseSchema>
export type ListToolJobsInput = z.infer<typeof listToolJobsInputSchema>
export type ToolJobsListResponse = z.infer<typeof toolJobsListResponseSchema>
