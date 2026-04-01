import { z } from 'zod'

import { appActions, appSubjects } from '../abilities/subjects'
import { aiKnowledgeMetadataSchema } from './ai-knowledge'
import { aiAuditLogEntrySchema } from './ai-tools'
import { paginatedResponseSchema } from './common'
import { dependencyHealthStatusSchema, telemetryHealthSchema } from './health'

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

export const listUsersInputSchema = baseSearchSchema.extend({
  status: booleanQuerySchema.optional(),
})

export const userListItemSchema = z.object({
  createdAt: z.string(),
  email: z.string().email(),
  id: z.string().uuid(),
  nickname: z.string().nullable(),
  roleCodes: z.array(z.string()),
  status: z.boolean(),
  updatedAt: z.string(),
  username: z.string(),
})

export const userListResponseSchema = paginatedResponseSchema(userListItemSchema)

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

export const listAiEvalsInputSchema = queryPaginationSchema

export const aiEvalListItemSchema = z.object({
  backing: z.literal('mastra'),
  datasetSize: z.number().int().min(0),
  id: z.string(),
  lastRunAt: z.string().nullable(),
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

export type ListUsersInput = z.infer<typeof listUsersInputSchema>
export type UserListResponse = z.infer<typeof userListResponseSchema>
export type ListRolesInput = z.infer<typeof listRolesInputSchema>
export type RoleListResponse = z.infer<typeof roleListResponseSchema>
export type ListPermissionsInput = z.infer<typeof listPermissionsInputSchema>
export type PermissionListResponse = z.infer<typeof permissionListResponseSchema>
export type ListMenusInput = z.infer<typeof listMenusInputSchema>
export type MenuListResponse = z.infer<typeof menuListResponseSchema>
export type ListOperationLogsInput = z.infer<typeof listOperationLogsInputSchema>
export type OperationLogListResponse = z.infer<typeof operationLogListResponseSchema>
export type ListOnlineUsersInput = z.infer<typeof listOnlineUsersInputSchema>
export type OnlineUserListResponse = z.infer<typeof onlineUserListResponseSchema>
export type ServerSummary = z.infer<typeof serverSummarySchema>
export type ListKnowledgeInput = z.infer<typeof listKnowledgeInputSchema>
export type KnowledgeListResponse = z.infer<typeof knowledgeListResponseSchema>
export type ListAiAuditLogsInput = z.infer<typeof listAiAuditLogsInputSchema>
export type AiAuditListResponse = z.infer<typeof aiAuditListResponseSchema>
export type ListAiEvalsInput = z.infer<typeof listAiEvalsInputSchema>
export type AiEvalListResponse = z.infer<typeof aiEvalListResponseSchema>
