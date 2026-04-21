import {
  type AppActions,
  type AppSubjects,
  activatePromptVersionInputSchema,
  aiAuditDetailSchema,
  aiAuditListResponseSchema,
  aiEvalDetailSchema,
  aiEvalListResponseSchema,
  aiEvalRunDetailSchema,
  aiEvalRunResultSchema,
  aiFeedbackDetailSchema,
  aiFeedbackEntrySchema,
  aiFeedbackListResponseSchema,
  aiGovernanceOverviewSchema,
  attachPromptEvalEvidenceInputSchema,
  configListItemSchema,
  configListResponseSchema,
  createAiFeedbackInputSchema,
  createConfigInputSchema,
  createDictInputSchema,
  createKnowledgeInputSchema,
  createMenuInputSchema,
  createPermissionInputSchema,
  createPromptVersionInputSchema,
  createRoleInputSchema,
  createUserInputSchema,
  currentPermissionsResponseSchema,
  deleteConfigInputSchema,
  deleteConfigResultSchema,
  deleteDictInputSchema,
  deleteDictResultSchema,
  deleteKnowledgeInputSchema,
  deleteKnowledgeResultSchema,
  deleteMenuInputSchema,
  deleteMenuResultSchema,
  deletePermissionInputSchema,
  deletePermissionResultSchema,
  deleteRoleInputSchema,
  deleteRoleResultSchema,
  deleteUserInputSchema,
  deleteUserResultSchema,
  dictListItemSchema,
  dictListResponseSchema,
  getAiAuditLogByIdInputSchema,
  getAiEvalByIdInputSchema,
  getAiEvalRunByIdInputSchema,
  getAiFeedbackByIdInputSchema,
  getConfigByIdInputSchema,
  getDictByIdInputSchema,
  getKnowledgeByIdInputSchema,
  getMenuByIdInputSchema,
  getPermissionAuditByIdInputSchema,
  getPermissionByIdInputSchema,
  getPermissionImpactByIdInputSchema,
  getPromptGovernanceFailureAuditInputSchema,
  getPromptGovernanceReviewInputSchema,
  getPromptReleaseAuditInputSchema,
  getPromptRollbackChainInputSchema,
  getPromptVersionByIdInputSchema,
  getPromptVersionCompareInputSchema,
  getPromptVersionHistoryInputSchema,
  getRoleByIdInputSchema,
  getUserByIdInputSchema,
  healthResponseSchema,
  knowledgeEntrySchema,
  knowledgeListResponseSchema,
  listAiAuditLogsInputSchema,
  listAiEvalsInputSchema,
  listAiFeedbackInputSchema,
  listAiGovernanceOverviewInputSchema,
  listConfigsInputSchema,
  listDictsInputSchema,
  listKnowledgeInputSchema,
  listMenusInputSchema,
  listOnlineUsersInputSchema,
  listOperationLogsInputSchema,
  listPermissionsInputSchema,
  listPrincipalRepairCandidatesInputSchema,
  listRolesInputSchema,
  listUsersInputSchema,
  menuEntrySchema,
  menuListResponseSchema,
  onlineUserListResponseSchema,
  operationLogListResponseSchema,
  permissionAuditTrailSchema,
  permissionEntrySchema,
  permissionImpactSchema,
  permissionListResponseSchema,
  principalRepairCandidateListResponseSchema,
  principalRepairResultSchema,
  promptGovernanceFailureAuditSchema,
  promptGovernanceReviewSchema,
  promptReleaseAuditSchema,
  promptRollbackChainSchema,
  promptVersionCompareSchema,
  promptVersionDetailSchema,
  promptVersionEntrySchema,
  promptVersionHistorySchema,
  promptVersionListInputSchema,
  promptVersionListResponseSchema,
  repairPrincipalBindingsInputSchema,
  roleEntrySchema,
  roleListResponseSchema,
  rollbackPromptVersionInputSchema,
  runAiEvalInputSchema,
  serializedAbilityResponseSchema,
  updateConfigInputSchema,
  updateDictInputSchema,
  updateKnowledgeInputSchema,
  updateMenuInputSchema,
  updatePermissionInputSchema,
  updateRoleInputSchema,
  updateUserInputSchema,
  userEntrySchema,
  userListResponseSchema,
} from '@ai-native-os/shared'
import type { HonoBindings, HonoVariables } from '@mastra/hono'
import { ORPCError } from '@orpc/server'
import { RPCHandler } from '@orpc/server/fetch'
import { Scalar } from '@scalar/hono-api-reference'
import type { Context } from 'hono'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { requestId } from 'hono/request-id'
import { secureHeaders } from 'hono/secure-headers'
import type { z } from 'zod'

import {
  agUiRuntimeEventsPath,
  agUiRuntimePath,
  copilotKitEndpointPath,
  handleAgUiRuntimeEventsRequest,
  handleAgUiRuntimeSummaryRequest,
  handleCopilotKitRequest,
} from '@/copilotkit/runtime'
import {
  createApiErrorPayload,
  createValidationErrorPayload,
  jsonApiError,
  normalizeApiHttpStatus,
} from '@/lib/api-errors'
import { getApiHealthSnapshot } from '@/lib/health'
import { generateOpenApiDocument } from '@/lib/openapi'
import { initializeTelemetry } from '@/lib/telemetry'
import { getMastraRuntimeSummary, mastra, mastraEnvironment } from '@/mastra'
import { handleMastraMcpRequest, mastraMcpEndpointPath } from '@/mastra/mcp/server'
import { readMastraRequestContext } from '@/mastra/request-context'
import { SecureMastraServer } from '@/mastra/server'
import { type ApiEnv, authSessionMiddleware, handleAuditedAuthRequest } from '@/middleware/auth'
import {
  createApiRateLimitMiddleware,
  resolveApiRateLimitEnvironment,
} from '@/middleware/rate-limit'
import { createAppContext } from '@/orpc/context'
import { appRouter } from '@/routes'
import { getAiAuditLogDetail, listAiAuditLogs } from '@/routes/ai/audit'
import { getAiEvalById, getAiEvalRunById, listAiEvals, runAiEval } from '@/routes/ai/evals'
import { createFeedback, getFeedbackById, listFeedback } from '@/routes/ai/feedback'
import { getAiGovernanceOverview, getPromptGovernanceReview } from '@/routes/ai/governance'
import {
  createKnowledgeEntry,
  deleteKnowledgeEntry,
  getKnowledgeById,
  listKnowledge,
  updateKnowledgeEntry,
} from '@/routes/ai/knowledge'
import {
  activatePromptVersionEntry,
  attachPromptVersionEvalEvidence,
  createPromptVersionEntry,
  getPromptGovernanceFailureAuditEntry,
  getPromptReleaseAuditEntry,
  getPromptRollbackChainEntry,
  getPromptVersionCompareEntry,
  getPromptVersionEntryById,
  getPromptVersionHistoryEntry,
  listPromptVersionEntries,
  rollbackPromptVersionEntry,
} from '@/routes/ai/prompts'
import { listMonitorLogs } from '@/routes/monitor/logs'
import { listOnlineUsers } from '@/routes/monitor/online'
import {
  createConfigEntry,
  deleteConfigEntry,
  getConfigById,
  listConfigs,
  updateConfigEntry,
} from '@/routes/system/config'
import {
  createDictEntry,
  deleteDictEntry,
  getDictById,
  listDicts,
  updateDictEntry,
} from '@/routes/system/dicts'
import {
  createMenuEntry,
  deleteMenuEntry,
  getMenuById,
  listMenus,
  updateMenuEntry,
} from '@/routes/system/menus'
import {
  createPermissionEntry,
  deletePermissionEntry,
  getPermissionAuditById,
  getPermissionById,
  getPermissionImpactById,
  listPermissions,
  updatePermissionEntry,
} from '@/routes/system/permissions'
import {
  listPrincipalRepairCandidates,
  repairPrincipalBindingsEntry,
} from '@/routes/system/principal-repair'
import {
  createRoleEntry,
  deleteRoleEntry,
  getRoleById,
  listRoles,
  updateRoleEntry,
} from '@/routes/system/roles'
import {
  createUserEntry,
  deleteUserEntry,
  getUserById,
  listUsers,
  updateUserEntry,
} from '@/routes/system/users'

const rpcHandler = new RPCHandler(appRouter)

interface AppEnv extends ApiEnv {
  Bindings: HonoBindings
  Variables: ApiEnv['Variables'] & HonoVariables
}

export const app = new Hono<AppEnv>()
initializeTelemetry()
const apiRateLimitEnvironment = resolveApiRateLimitEnvironment()

const contractFirstReadRequirements = {
  aiAudit: [
    { action: 'read', subject: 'AiAuditLog' },
    { action: 'manage', subject: 'all' },
  ],
  aiFeedback: [
    { action: 'read', subject: 'AiAuditLog' },
    { action: 'manage', subject: 'all' },
  ],
  aiGovernance: [
    { action: 'read', subject: 'AiAuditLog' },
    { action: 'manage', subject: 'AiKnowledge' },
  ],
  aiEvals: [
    { action: 'read', subject: 'AiAuditLog' },
    { action: 'manage', subject: 'AiKnowledge' },
  ],
  aiKnowledge: [
    { action: 'read', subject: 'AiKnowledge' },
    { action: 'manage', subject: 'AiKnowledge' },
  ],
  aiPrompts: [
    { action: 'read', subject: 'AiAuditLog' },
    { action: 'manage', subject: 'AiKnowledge' },
  ],
  menus: [
    { action: 'read', subject: 'Menu' },
    { action: 'manage', subject: 'Menu' },
  ],
  config: [
    { action: 'read', subject: 'Config' },
    { action: 'manage', subject: 'Config' },
  ],
  dicts: [
    { action: 'read', subject: 'Dict' },
    { action: 'manage', subject: 'Dict' },
  ],
  monitorLogs: [
    { action: 'read', subject: 'OperationLog' },
    { action: 'manage', subject: 'all' },
  ],
  onlineUsers: [
    { action: 'read', subject: 'User' },
    { action: 'manage', subject: 'User' },
  ],
  permissions: [
    { action: 'read', subject: 'Permission' },
    { action: 'manage', subject: 'Permission' },
  ],
  roles: [
    { action: 'read', subject: 'Role' },
    { action: 'manage', subject: 'Role' },
  ],
  users: [
    { action: 'read', subject: 'User' },
    { action: 'manage', subject: 'User' },
  ],
} as const satisfies Record<
  string,
  ReadonlyArray<{
    action: AppActions
    subject: AppSubjects
  }>
>

const contractFirstWriteRequirements = {
  aiEvals: [
    { action: 'manage', subject: 'AiKnowledge' },
    { action: 'manage', subject: 'all' },
  ],
  aiKnowledge: [
    { action: 'manage', subject: 'AiKnowledge' },
    { action: 'manage', subject: 'all' },
  ],
  aiPrompts: [
    { action: 'manage', subject: 'AiKnowledge' },
    { action: 'manage', subject: 'all' },
  ],
  menus: [
    { action: 'manage', subject: 'Menu' },
    { action: 'manage', subject: 'all' },
  ],
  config: [
    { action: 'manage', subject: 'Config' },
    { action: 'manage', subject: 'all' },
  ],
  dicts: [
    { action: 'manage', subject: 'Dict' },
    { action: 'manage', subject: 'all' },
  ],
  permissions: [
    { action: 'manage', subject: 'Permission' },
    { action: 'manage', subject: 'all' },
  ],
  roles: [
    { action: 'manage', subject: 'Role' },
    { action: 'manage', subject: 'all' },
  ],
  users: [
    { action: 'manage', subject: 'User' },
    { action: 'manage', subject: 'all' },
  ],
} as const satisfies Record<
  string,
  ReadonlyArray<{
    action: AppActions
    subject: AppSubjects
  }>
>

/**
 * 统一输出标准未认证响应，避免 REST 兼容入口与 oRPC 错误语义分叉。
 */
function jsonUnauthorized<TEnv extends AppEnv>(c: Context<TEnv>): Response {
  return jsonApiError(c, 'UNAUTHORIZED', 401, 'Authentication required')
}

/**
 * 统一输出标准权限不足响应，确保兼容入口不会绕过现有 RBAC 边界。
 */
function jsonForbidden<TEnv extends AppEnv>(c: Context<TEnv>, message: string): Response {
  return jsonApiError(c, 'FORBIDDEN', 403, message)
}

/**
 * 统一输出查询参数校验错误，确保 contract-first REST 请求得到稳定错误格式。
 */
function jsonBadRequest<TEnv extends AppEnv>(
  c: Context<TEnv>,
  error: z.ZodError,
  message = 'Invalid query parameters',
): Response {
  return c.json(createValidationErrorPayload(error, c.get('requestId'), message), 400)
}

/**
 * 复用 oRPC 错误语义，将 contract-first 兼容入口的业务异常映射为稳定 HTTP 响应。
 */
function jsonOrpcError<TEnv extends AppEnv>(
  c: Context<TEnv>,
  error: {
    code: string
    message: string
    status?: number
  },
): Response {
  if (error.code === 'UNAUTHORIZED') {
    return jsonUnauthorized(c)
  }

  if (error.code === 'FORBIDDEN') {
    return jsonForbidden(c, error.message)
  }

  if (error.code === 'BAD_REQUEST') {
    return c.json(createApiErrorPayload('BAD_REQUEST', 400, error.message, c.get('requestId')), 400)
  }

  if (error.code === 'NOT_FOUND') {
    return c.json(createApiErrorPayload('NOT_FOUND', 404, error.message, c.get('requestId')), 404)
  }

  if (
    error.code === 'AI_EVAL_NOT_FOUND' ||
    error.code === 'AI_EVAL_RUN_NOT_FOUND' ||
    error.code === 'AI_FEEDBACK_NOT_FOUND' ||
    error.code === 'AI_AUDIT_LOG_NOT_FOUND' ||
    error.code === 'AI_PROMPT_NOT_FOUND'
  ) {
    const normalizedStatus = normalizeApiHttpStatus(error.status)

    return c.json(
      createApiErrorPayload(error.code, normalizedStatus, error.message, c.get('requestId')),
      normalizedStatus,
    )
  }

  if (
    error.code === 'IDEMPOTENCY_REQUEST_IN_PROGRESS' ||
    error.code === 'IDEMPOTENCY_PAYLOAD_MISMATCH' ||
    error.code === 'AI_PROMPT_RELEASE_GATE_FAILED' ||
    error.code === 'AI_PROMPT_COMPARE_MISMATCH'
  ) {
    const normalizedStatus = normalizeApiHttpStatus(error.status)

    return c.json(
      createApiErrorPayload(error.code, normalizedStatus, error.message, c.get('requestId')),
      normalizedStatus,
    )
  }

  throw error
}

/**
 * 判断当前请求上下文是否满足任一权限要求。
 */
function canAccessContractFirstRoute(
  c: Awaited<ReturnType<typeof createAppContext>>,
  requirements: ReadonlyArray<{
    action: AppActions
    subject: AppSubjects
  }>,
): boolean {
  return requirements.some((requirement) => c.ability.can(requirement.action, requirement.subject))
}

/**
 * 为 contract-first GET 路由提供 REST query 兼容层，同时复用统一认证与 RBAC 约束。
 */
async function handleContractFirstGet<TInput, TOutput, TEnv extends AppEnv>(
  c: Context<TEnv>,
  inputSchema: z.ZodType<TInput>,
  outputSchema: z.ZodType<TOutput>,
  requirements: ReadonlyArray<{
    action: AppActions
    subject: AppSubjects
  }>,
  loader: (input: TInput) => Promise<TOutput>,
  resolveInput?: (c: Context<TEnv>) => unknown,
): Promise<Response> {
  const context = await createAppContext(c)

  if (!context.session) {
    return jsonUnauthorized(c)
  }

  if (!canAccessContractFirstRoute(context, requirements)) {
    return jsonForbidden(
      c,
      requirements.map((requirement) => `${requirement.action}:${requirement.subject}`).join(' | '),
    )
  }

  const parsedInput = inputSchema.safeParse(resolveInput ? resolveInput(c) : c.req.query())

  if (!parsedInput.success) {
    return jsonBadRequest(c, parsedInput.error)
  }

  let payload: TOutput

  try {
    payload = await loader(parsedInput.data)
  } catch (error) {
    if (error instanceof ORPCError) {
      return jsonOrpcError(c, error)
    }

    throw error
  }

  return c.json({
    json: outputSchema.parse(payload),
  })
}

/**
 * 为 contract-first POST 路由提供 JSON body 兼容层，同时复用统一认证与 RBAC 约束。
 */
async function handleContractFirstPost<TInput, TOutput, TEnv extends AppEnv>(
  c: Context<TEnv>,
  inputSchema: z.ZodType<TInput>,
  outputSchema: z.ZodType<TOutput>,
  requirements: ReadonlyArray<{
    action: AppActions
    subject: AppSubjects
  }>,
  loader: (
    input: TInput,
    context: Awaited<ReturnType<typeof createAppContext>>,
  ) => Promise<TOutput>,
  resolveInput?: (c: Context<TEnv>, requestJson: unknown) => unknown,
): Promise<Response> {
  const context = await createAppContext(c)

  if (!context.session) {
    return jsonUnauthorized(c)
  }

  if (!canAccessContractFirstRoute(context, requirements)) {
    return jsonForbidden(
      c,
      requirements.map((requirement) => `${requirement.action}:${requirement.subject}`).join(' | '),
    )
  }

  const requestJson = await c.req.json().catch(() => null)
  const parsedInput = inputSchema.safeParse(
    resolveInput ? resolveInput(c, requestJson) : requestJson,
  )

  if (!parsedInput.success) {
    return jsonBadRequest(c, parsedInput.error, 'Invalid request payload')
  }

  let payload: TOutput

  try {
    payload = await loader(parsedInput.data, context)
  } catch (error) {
    if (error instanceof ORPCError) {
      return jsonOrpcError(c, error)
    }

    throw error
  }

  return c.json({
    json: outputSchema.parse(payload),
  })
}

app.use('*', secureHeaders())
app.use(
  '*',
  cors({
    allowHeaders: [
      'content-type',
      'idempotency-key',
      'last-event-id',
      'mcp-protocol-version',
      'mcp-session-id',
      'x-requested-with',
      'x-request-id',
    ],
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    exposeHeaders: ['mcp-protocol-version', 'mcp-session-id'],
    origin: process.env.APP_URL ?? 'http://localhost:3000',
    credentials: true,
  }),
)
app.use('*', requestId({ headerName: 'x-request-id' }))
app.use('*', async (c, next) => {
  const start = Date.now()
  await next()
  const durationMs = Date.now() - start
  c.header('x-request-id', c.get('requestId'))
  console.log(
    `[${c.get('requestId')}] ${c.req.method} ${c.req.path} ${c.res.status} ${durationMs}ms`,
  )
})
app.use('*', createApiRateLimitMiddleware(apiRateLimitEnvironment))

app.get('/health', async (c) => {
  const response = healthResponseSchema.parse(await getApiHealthSnapshot())

  return c.json(response, response.status === 'ok' ? 200 : 503)
})

app.get('/api/openapi.json', async (c) => {
  const document = await generateOpenApiDocument()
  return c.json(document)
})

const mastraServer = new SecureMastraServer({
  app,
  mastra,
  openapiPath: mastraEnvironment.openapiPath,
  prefix: mastraEnvironment.routePrefix,
})

await mastraServer.init()

app.get('/mastra/system/request-context', (c) => {
  return c.json(readMastraRequestContext(c.get('requestContext')))
})

app.get(
  '/api/docs',
  Scalar({
    url: '/api/openapi.json',
    pageTitle: 'AI Native OS API',
    theme: 'kepler',
  }),
)

app.all('/api/auth/*', async (c) => handleAuditedAuthRequest(c))

app.use(mastraMcpEndpointPath, authSessionMiddleware)
app.use(copilotKitEndpointPath, authSessionMiddleware)
app.use(agUiRuntimePath, authSessionMiddleware)
app.use(agUiRuntimeEventsPath, authSessionMiddleware)

app.all(mastraMcpEndpointPath, handleMastraMcpRequest)
app.all(copilotKitEndpointPath, handleCopilotKitRequest)
app.get(agUiRuntimePath, handleAgUiRuntimeSummaryRequest)
app.get(agUiRuntimeEventsPath, handleAgUiRuntimeEventsRequest)

app.get('/api/v1/system/mastra-runtime', (c) => {
  return c.json({
    json: getMastraRuntimeSummary(),
  })
})

app.use('/api/v1/*', authSessionMiddleware)

app.get('/api/v1/system/users', (c) =>
  handleContractFirstGet(
    c,
    listUsersInputSchema,
    userListResponseSchema,
    contractFirstReadRequirements.users,
    listUsers,
  ),
)

app.get('/api/v1/system/users/principal-repair-candidates', (c) =>
  handleContractFirstGet(
    c,
    listPrincipalRepairCandidatesInputSchema,
    principalRepairCandidateListResponseSchema,
    contractFirstWriteRequirements.users,
    listPrincipalRepairCandidates,
  ),
)

app.post('/api/v1/system/users/principal-repair', (c) =>
  handleContractFirstPost(
    c,
    repairPrincipalBindingsInputSchema,
    principalRepairResultSchema,
    contractFirstWriteRequirements.users,
    async (input, context) =>
      repairPrincipalBindingsEntry(input, {
        actorRbacUserId: context.rbacUserId,
        requestId: context.requestId,
      }),
  ),
)

app.get('/api/v1/system/users/:id', (c) =>
  handleContractFirstGet(
    c,
    getUserByIdInputSchema,
    userEntrySchema,
    contractFirstReadRequirements.users,
    getUserById,
    (requestContext) => ({
      id: requestContext.req.param('id'),
    }),
  ),
)

app.post('/api/v1/system/users', (c) =>
  handleContractFirstPost(
    c,
    createUserInputSchema,
    userEntrySchema,
    contractFirstWriteRequirements.users,
    async (input, context) =>
      createUserEntry(input, {
        ability: context.ability,
        actorAuthUserId: context.userId ?? context.session?.user.id ?? 'unknown-user',
        actorRbacUserId: context.rbacUserId,
        requestId: context.requestId,
      }),
  ),
)

app.put('/api/v1/system/users/:id', (c) =>
  handleContractFirstPost(
    c,
    updateUserInputSchema,
    userEntrySchema,
    contractFirstWriteRequirements.users,
    async (input, context) =>
      updateUserEntry(input, {
        ability: context.ability,
        actorAuthUserId: context.userId ?? context.session?.user.id ?? 'unknown-user',
        actorRbacUserId: context.rbacUserId,
        requestId: context.requestId,
      }),
    (requestContext, requestJson) => ({
      ...(typeof requestJson === 'object' && requestJson !== null ? requestJson : {}),
      id: requestContext.req.param('id'),
    }),
  ),
)

app.delete('/api/v1/system/users/:id', (c) =>
  handleContractFirstPost(
    c,
    deleteUserInputSchema,
    deleteUserResultSchema,
    contractFirstWriteRequirements.users,
    async (input, context) =>
      deleteUserEntry(input, {
        ability: context.ability,
        actorAuthUserId: context.userId ?? context.session?.user.id ?? 'unknown-user',
        actorRbacUserId: context.rbacUserId,
        requestId: context.requestId,
      }),
    (requestContext) => ({
      id: requestContext.req.param('id'),
    }),
  ),
)

app.get('/api/v1/system/roles', (c) =>
  handleContractFirstGet(
    c,
    listRolesInputSchema,
    roleListResponseSchema,
    contractFirstReadRequirements.roles,
    listRoles,
  ),
)

app.get('/api/v1/system/roles/:id', (c) =>
  handleContractFirstGet(
    c,
    getRoleByIdInputSchema,
    roleEntrySchema,
    contractFirstReadRequirements.roles,
    getRoleById,
    (requestContext) => ({
      id: requestContext.req.param('id'),
    }),
  ),
)

app.post('/api/v1/system/roles', (c) =>
  handleContractFirstPost(
    c,
    createRoleInputSchema,
    roleEntrySchema,
    contractFirstWriteRequirements.roles,
    async (input, context) =>
      createRoleEntry(input, {
        actorRbacUserId: context.rbacUserId,
        requestId: context.requestId,
      }),
  ),
)

app.put('/api/v1/system/roles/:id', (c) =>
  handleContractFirstPost(
    c,
    updateRoleInputSchema,
    roleEntrySchema,
    contractFirstWriteRequirements.roles,
    async (input, context) =>
      updateRoleEntry(input, {
        actorRbacUserId: context.rbacUserId,
        requestId: context.requestId,
      }),
    (requestContext, requestJson) => ({
      ...(typeof requestJson === 'object' && requestJson !== null ? requestJson : {}),
      id: requestContext.req.param('id'),
    }),
  ),
)

app.delete('/api/v1/system/roles/:id', (c) =>
  handleContractFirstPost(
    c,
    deleteRoleInputSchema,
    deleteRoleResultSchema,
    contractFirstWriteRequirements.roles,
    async (input, context) =>
      deleteRoleEntry(input, {
        actorRbacUserId: context.rbacUserId,
        requestId: context.requestId,
      }),
    (requestContext) => ({
      id: requestContext.req.param('id'),
    }),
  ),
)

app.get('/api/v1/system/config', (c) =>
  handleContractFirstGet(
    c,
    listConfigsInputSchema,
    configListResponseSchema,
    contractFirstReadRequirements.config,
    listConfigs,
  ),
)

app.get('/api/v1/system/config/:id', (c) =>
  handleContractFirstGet(
    c,
    getConfigByIdInputSchema,
    configListItemSchema,
    contractFirstReadRequirements.config,
    getConfigById,
    (requestContext) => ({
      id: requestContext.req.param('id'),
    }),
  ),
)

app.post('/api/v1/system/config', (c) =>
  handleContractFirstPost(
    c,
    createConfigInputSchema,
    configListItemSchema,
    contractFirstWriteRequirements.config,
    async (input, context) =>
      createConfigEntry(input, {
        actorRbacUserId: context.rbacUserId,
        requestId: context.requestId,
      }),
  ),
)

app.put('/api/v1/system/config/:id', (c) =>
  handleContractFirstPost(
    c,
    updateConfigInputSchema,
    configListItemSchema,
    contractFirstWriteRequirements.config,
    async (input, context) =>
      updateConfigEntry(input, {
        actorRbacUserId: context.rbacUserId,
        requestId: context.requestId,
      }),
    (requestContext, requestJson) => ({
      ...(typeof requestJson === 'object' && requestJson !== null ? requestJson : {}),
      id: requestContext.req.param('id'),
    }),
  ),
)

app.delete('/api/v1/system/config/:id', (c) =>
  handleContractFirstPost(
    c,
    deleteConfigInputSchema,
    deleteConfigResultSchema,
    contractFirstWriteRequirements.config,
    async (input, context) =>
      deleteConfigEntry(input, {
        actorRbacUserId: context.rbacUserId,
        requestId: context.requestId,
      }),
    (requestContext) => ({
      id: requestContext.req.param('id'),
    }),
  ),
)

app.get('/api/v1/system/dicts', (c) =>
  handleContractFirstGet(
    c,
    listDictsInputSchema,
    dictListResponseSchema,
    contractFirstReadRequirements.dicts,
    listDicts,
  ),
)

app.get('/api/v1/system/dicts/:id', (c) =>
  handleContractFirstGet(
    c,
    getDictByIdInputSchema,
    dictListItemSchema,
    contractFirstReadRequirements.dicts,
    getDictById,
    (requestContext) => ({
      id: requestContext.req.param('id'),
    }),
  ),
)

app.post('/api/v1/system/dicts', (c) =>
  handleContractFirstPost(
    c,
    createDictInputSchema,
    dictListItemSchema,
    contractFirstWriteRequirements.dicts,
    async (input, context) =>
      createDictEntry(input, {
        actorRbacUserId: context.rbacUserId,
        requestId: context.requestId,
      }),
  ),
)

app.put('/api/v1/system/dicts/:id', (c) =>
  handleContractFirstPost(
    c,
    updateDictInputSchema,
    dictListItemSchema,
    contractFirstWriteRequirements.dicts,
    async (input, context) =>
      updateDictEntry(input, {
        actorRbacUserId: context.rbacUserId,
        requestId: context.requestId,
      }),
    (requestContext, requestJson) => ({
      ...(typeof requestJson === 'object' && requestJson !== null ? requestJson : {}),
      id: requestContext.req.param('id'),
    }),
  ),
)

app.delete('/api/v1/system/dicts/:id', (c) =>
  handleContractFirstPost(
    c,
    deleteDictInputSchema,
    deleteDictResultSchema,
    contractFirstWriteRequirements.dicts,
    async (input, context) =>
      deleteDictEntry(input, {
        actorRbacUserId: context.rbacUserId,
        requestId: context.requestId,
      }),
    (requestContext) => ({
      id: requestContext.req.param('id'),
    }),
  ),
)

app.get('/api/v1/system/permissions', (c) =>
  handleContractFirstGet(
    c,
    listPermissionsInputSchema,
    permissionListResponseSchema,
    contractFirstReadRequirements.permissions,
    listPermissions,
  ),
)

app.get('/api/v1/system/permissions/current', async (c) => {
  const context = await createAppContext(c)

  if (!context.session) {
    return c.json(
      createApiErrorPayload('UNAUTHORIZED', 401, 'Authentication required', c.get('requestId')),
      401,
    )
  }

  return c.json({
    json: currentPermissionsResponseSchema.parse({
      permissionRules: context.permissionRules,
      rbacUserId: context.rbacUserId,
      roleCodes: context.roleCodes,
      userId: context.userId,
    }),
  })
})

app.get('/api/v1/system/permissions/ability', async (c) => {
  const context = await createAppContext(c)

  if (!context.session) {
    return c.json(
      createApiErrorPayload('UNAUTHORIZED', 401, 'Authentication required', c.get('requestId')),
      401,
    )
  }

  return c.json({
    json: serializedAbilityResponseSchema.parse({
      roleCodes: context.roleCodes,
      rules: context.permissionRules,
      userId: context.userId,
    }),
  })
})

app.get('/api/v1/system/permissions/:id/impact', (c) =>
  handleContractFirstGet(
    c,
    getPermissionImpactByIdInputSchema,
    permissionImpactSchema,
    contractFirstReadRequirements.permissions,
    getPermissionImpactById,
    (requestContext) => ({
      id: requestContext.req.param('id'),
    }),
  ),
)

app.get('/api/v1/system/permissions/:id/audit', (c) =>
  handleContractFirstGet(
    c,
    getPermissionAuditByIdInputSchema,
    permissionAuditTrailSchema,
    contractFirstReadRequirements.permissions,
    getPermissionAuditById,
    (requestContext) => ({
      id: requestContext.req.param('id'),
    }),
  ),
)

app.get('/api/v1/system/permissions/:id', (c) =>
  handleContractFirstGet(
    c,
    getPermissionByIdInputSchema,
    permissionEntrySchema,
    contractFirstReadRequirements.permissions,
    getPermissionById,
    (requestContext) => ({
      id: requestContext.req.param('id'),
    }),
  ),
)

app.post('/api/v1/system/permissions', (c) =>
  handleContractFirstPost(
    c,
    createPermissionInputSchema,
    permissionEntrySchema,
    contractFirstWriteRequirements.permissions,
    async (input, context) =>
      createPermissionEntry(input, {
        actorRbacUserId: context.rbacUserId,
        requestId: context.requestId,
      }),
  ),
)

app.put('/api/v1/system/permissions/:id', (c) =>
  handleContractFirstPost(
    c,
    updatePermissionInputSchema,
    permissionEntrySchema,
    contractFirstWriteRequirements.permissions,
    async (input, context) =>
      updatePermissionEntry(input, {
        actorRbacUserId: context.rbacUserId,
        requestId: context.requestId,
      }),
    (requestContext, requestJson) => ({
      ...(typeof requestJson === 'object' && requestJson !== null ? requestJson : {}),
      id: requestContext.req.param('id'),
    }),
  ),
)

app.delete('/api/v1/system/permissions/:id', (c) =>
  handleContractFirstPost(
    c,
    deletePermissionInputSchema,
    deletePermissionResultSchema,
    contractFirstWriteRequirements.permissions,
    async (input, context) =>
      deletePermissionEntry(input, {
        actorRbacUserId: context.rbacUserId,
        requestId: context.requestId,
      }),
    (requestContext) => ({
      id: requestContext.req.param('id'),
    }),
  ),
)

app.get('/api/v1/system/menus', (c) =>
  handleContractFirstGet(
    c,
    listMenusInputSchema,
    menuListResponseSchema,
    contractFirstReadRequirements.menus,
    listMenus,
  ),
)

app.get('/api/v1/system/menus/:id', (c) =>
  handleContractFirstGet(
    c,
    getMenuByIdInputSchema,
    menuEntrySchema,
    contractFirstReadRequirements.menus,
    getMenuById,
    (requestContext) => ({
      id: requestContext.req.param('id'),
    }),
  ),
)

app.post('/api/v1/system/menus', (c) =>
  handleContractFirstPost(
    c,
    createMenuInputSchema,
    menuEntrySchema,
    contractFirstWriteRequirements.menus,
    async (input, context) =>
      createMenuEntry(input, {
        actorRbacUserId: context.rbacUserId,
        requestId: context.requestId,
      }),
  ),
)

app.put('/api/v1/system/menus/:id', (c) =>
  handleContractFirstPost(
    c,
    updateMenuInputSchema,
    menuEntrySchema,
    contractFirstWriteRequirements.menus,
    async (input, context) =>
      updateMenuEntry(input, {
        actorRbacUserId: context.rbacUserId,
        requestId: context.requestId,
      }),
    (requestContext, requestJson) => ({
      ...(typeof requestJson === 'object' && requestJson !== null ? requestJson : {}),
      id: requestContext.req.param('id'),
    }),
  ),
)

app.delete('/api/v1/system/menus/:id', (c) =>
  handleContractFirstPost(
    c,
    deleteMenuInputSchema,
    deleteMenuResultSchema,
    contractFirstWriteRequirements.menus,
    async (input, context) =>
      deleteMenuEntry(input, {
        actorRbacUserId: context.rbacUserId,
        requestId: context.requestId,
      }),
    (requestContext) => ({
      id: requestContext.req.param('id'),
    }),
  ),
)

app.get('/api/v1/monitor/logs', (c) =>
  handleContractFirstGet(
    c,
    listOperationLogsInputSchema,
    operationLogListResponseSchema,
    contractFirstReadRequirements.monitorLogs,
    listMonitorLogs,
  ),
)

app.get('/api/v1/monitor/online', (c) =>
  handleContractFirstGet(
    c,
    listOnlineUsersInputSchema,
    onlineUserListResponseSchema,
    contractFirstReadRequirements.onlineUsers,
    listOnlineUsers,
  ),
)

app.get('/api/v1/ai/knowledge', (c) =>
  handleContractFirstGet(
    c,
    listKnowledgeInputSchema,
    knowledgeListResponseSchema,
    contractFirstReadRequirements.aiKnowledge,
    listKnowledge,
  ),
)

app.get('/api/v1/ai/knowledge/:id', (c) =>
  handleContractFirstGet(
    c,
    getKnowledgeByIdInputSchema,
    knowledgeEntrySchema,
    contractFirstReadRequirements.aiKnowledge,
    getKnowledgeById,
    (requestContext) => ({
      id: requestContext.req.param('id'),
    }),
  ),
)

app.post('/api/v1/ai/knowledge', (c) =>
  handleContractFirstPost(
    c,
    createKnowledgeInputSchema,
    knowledgeEntrySchema,
    contractFirstWriteRequirements.aiKnowledge,
    async (input, context) => createKnowledgeEntry(input, context),
  ),
)

app.put('/api/v1/ai/knowledge/:id', (c) =>
  handleContractFirstPost(
    c,
    updateKnowledgeInputSchema,
    knowledgeEntrySchema,
    contractFirstWriteRequirements.aiKnowledge,
    async (input, context) => updateKnowledgeEntry(input, context),
    (requestContext, requestJson) => ({
      ...(typeof requestJson === 'object' && requestJson !== null ? requestJson : {}),
      id: requestContext.req.param('id'),
    }),
  ),
)

app.delete('/api/v1/ai/knowledge/:id', (c) =>
  handleContractFirstPost(
    c,
    deleteKnowledgeInputSchema,
    deleteKnowledgeResultSchema,
    contractFirstWriteRequirements.aiKnowledge,
    async (input, context) => deleteKnowledgeEntry(input, context),
    (requestContext) => ({
      id: requestContext.req.param('id'),
    }),
  ),
)

app.get('/api/v1/ai/evals', (c) =>
  handleContractFirstGet(
    c,
    listAiEvalsInputSchema,
    aiEvalListResponseSchema,
    contractFirstReadRequirements.aiEvals,
    listAiEvals,
  ),
)

app.get('/api/v1/ai/evals/:id', (c) =>
  handleContractFirstGet(
    c,
    getAiEvalByIdInputSchema,
    aiEvalDetailSchema,
    contractFirstReadRequirements.aiEvals,
    getAiEvalById,
    (requestContext) => ({
      id: requestContext.req.param('id'),
    }),
  ),
)

app.get('/api/v1/ai/evals/:id/runs/:runId', (c) =>
  handleContractFirstGet(
    c,
    getAiEvalRunByIdInputSchema,
    aiEvalRunDetailSchema,
    contractFirstReadRequirements.aiEvals,
    getAiEvalRunById,
    (requestContext) => ({
      id: requestContext.req.param('id'),
      runId: requestContext.req.param('runId'),
    }),
  ),
)

app.post('/api/v1/ai/evals/:id/run', (c) =>
  handleContractFirstPost(
    c,
    runAiEvalInputSchema,
    aiEvalRunResultSchema,
    contractFirstWriteRequirements.aiEvals,
    async (input, context) =>
      runAiEval(input, {
        actorAuthUserId: context.userId ?? context.session?.user.id ?? 'unknown-user',
        actorRbacUserId: context.rbacUserId,
        idempotencyKey: context.idempotencyKey,
        requestId: context.requestId,
      }),
    (requestContext) => ({
      id: requestContext.req.param('id'),
    }),
  ),
)

app.get('/api/v1/ai/audit', (c) =>
  handleContractFirstGet(
    c,
    listAiAuditLogsInputSchema,
    aiAuditListResponseSchema,
    contractFirstReadRequirements.aiAudit,
    listAiAuditLogs,
  ),
)

app.get('/api/v1/ai/audit/:id', (c) =>
  handleContractFirstGet(
    c,
    getAiAuditLogByIdInputSchema,
    aiAuditDetailSchema,
    contractFirstReadRequirements.aiAudit,
    getAiAuditLogDetail,
    (requestContext) => ({
      id: requestContext.req.param('id'),
    }),
  ),
)

app.get('/api/v1/ai/feedback', (c) =>
  handleContractFirstGet(
    c,
    listAiFeedbackInputSchema,
    aiFeedbackListResponseSchema,
    contractFirstReadRequirements.aiFeedback,
    listFeedback,
  ),
)

app.get('/api/v1/ai/feedback/:id', (c) =>
  handleContractFirstGet(
    c,
    getAiFeedbackByIdInputSchema,
    aiFeedbackDetailSchema,
    contractFirstReadRequirements.aiFeedback,
    getFeedbackById,
    (requestContext) => ({
      id: requestContext.req.param('id'),
    }),
  ),
)

app.post('/api/v1/ai/feedback', (c) =>
  handleContractFirstPost(
    c,
    createAiFeedbackInputSchema,
    aiFeedbackEntrySchema,
    contractFirstReadRequirements.aiFeedback,
    async (input, context) =>
      createFeedback(input, {
        actorAuthUserId: context.userId ?? context.session?.user.id ?? 'unknown-user',
        actorRbacUserId: context.rbacUserId,
        idempotencyKey: context.idempotencyKey,
        requestId: context.requestId,
      }),
  ),
)

app.get('/api/v1/ai/governance/overview', (c) =>
  handleContractFirstGet(
    c,
    listAiGovernanceOverviewInputSchema,
    aiGovernanceOverviewSchema,
    contractFirstReadRequirements.aiGovernance,
    getAiGovernanceOverview,
  ),
)

app.get('/api/v1/ai/governance/prompts/:promptKey', (c) =>
  handleContractFirstGet(
    c,
    getPromptGovernanceReviewInputSchema,
    promptGovernanceReviewSchema,
    contractFirstReadRequirements.aiGovernance,
    getPromptGovernanceReview,
    (requestContext) => ({
      promptKey: requestContext.req.param('promptKey'),
    }),
  ),
)

app.get('/api/v1/ai/prompts', (c) =>
  handleContractFirstGet(
    c,
    promptVersionListInputSchema,
    promptVersionListResponseSchema,
    contractFirstReadRequirements.aiPrompts,
    listPromptVersionEntries,
  ),
)

app.get('/api/v1/ai/prompts/:id', (c) =>
  handleContractFirstGet(
    c,
    getPromptVersionByIdInputSchema,
    promptVersionDetailSchema,
    contractFirstReadRequirements.aiPrompts,
    getPromptVersionEntryById,
    (requestContext) => ({
      id: requestContext.req.param('id'),
    }),
  ),
)

app.get('/api/v1/ai/prompts/:id/release-audit', (c) =>
  handleContractFirstGet(
    c,
    getPromptReleaseAuditInputSchema,
    promptReleaseAuditSchema,
    contractFirstReadRequirements.aiPrompts,
    getPromptReleaseAuditEntry,
    (requestContext) => ({
      id: requestContext.req.param('id'),
    }),
  ),
)

app.get('/api/v1/ai/prompts/failure-audit/:promptKey', (c) =>
  handleContractFirstGet(
    c,
    getPromptGovernanceFailureAuditInputSchema,
    promptGovernanceFailureAuditSchema,
    contractFirstReadRequirements.aiPrompts,
    getPromptGovernanceFailureAuditEntry,
    (requestContext) => ({
      promptKey: requestContext.req.param('promptKey'),
    }),
  ),
)

app.get('/api/v1/ai/prompts/:id/compare/:baselineId', (c) =>
  handleContractFirstGet(
    c,
    getPromptVersionCompareInputSchema,
    promptVersionCompareSchema,
    contractFirstReadRequirements.aiPrompts,
    getPromptVersionCompareEntry,
    (requestContext) => ({
      baselineId: requestContext.req.param('baselineId'),
      id: requestContext.req.param('id'),
    }),
  ),
)

app.get('/api/v1/ai/prompts/history/:promptKey', (c) =>
  handleContractFirstGet(
    c,
    getPromptVersionHistoryInputSchema,
    promptVersionHistorySchema,
    contractFirstReadRequirements.aiPrompts,
    getPromptVersionHistoryEntry,
    (requestContext) => ({
      promptKey: requestContext.req.param('promptKey'),
    }),
  ),
)

app.get('/api/v1/ai/prompts/rollback-chain/:promptKey', (c) =>
  handleContractFirstGet(
    c,
    getPromptRollbackChainInputSchema,
    promptRollbackChainSchema,
    contractFirstReadRequirements.aiPrompts,
    getPromptRollbackChainEntry,
    (requestContext) => ({
      promptKey: requestContext.req.param('promptKey'),
    }),
  ),
)

app.post('/api/v1/ai/prompts', (c) =>
  handleContractFirstPost(
    c,
    createPromptVersionInputSchema,
    promptVersionEntrySchema,
    contractFirstWriteRequirements.aiPrompts,
    async (input, context) =>
      createPromptVersionEntry(input, {
        actorAuthUserId: context.userId ?? context.session?.user.id ?? 'unknown-user',
        actorRbacUserId: context.rbacUserId,
        idempotencyKey: context.idempotencyKey,
        requestId: context.requestId,
      }),
  ),
)

app.post('/api/v1/ai/prompts/attach-evidence', (c) =>
  handleContractFirstPost(
    c,
    attachPromptEvalEvidenceInputSchema,
    promptVersionEntrySchema,
    contractFirstWriteRequirements.aiPrompts,
    async (input, context) =>
      attachPromptVersionEvalEvidence(input, {
        actorAuthUserId: context.userId ?? context.session?.user.id ?? 'unknown-user',
        actorRbacUserId: context.rbacUserId,
        idempotencyKey: context.idempotencyKey,
        requestId: context.requestId,
      }),
  ),
)

app.post('/api/v1/ai/prompts/activate', (c) =>
  handleContractFirstPost(
    c,
    activatePromptVersionInputSchema,
    promptVersionEntrySchema,
    contractFirstWriteRequirements.aiPrompts,
    async (input, context) =>
      activatePromptVersionEntry(input, {
        actorAuthUserId: context.userId ?? context.session?.user.id ?? 'unknown-user',
        actorRbacUserId: context.rbacUserId,
        idempotencyKey: context.idempotencyKey,
        requestId: context.requestId,
      }),
  ),
)

app.post('/api/v1/ai/prompts/rollback', (c) =>
  handleContractFirstPost(
    c,
    rollbackPromptVersionInputSchema,
    promptVersionEntrySchema,
    contractFirstWriteRequirements.aiPrompts,
    async (input, context) =>
      rollbackPromptVersionEntry(input, {
        actorAuthUserId: context.userId ?? context.session?.user.id ?? 'unknown-user',
        actorRbacUserId: context.rbacUserId,
        idempotencyKey: context.idempotencyKey,
        requestId: context.requestId,
      }),
  ),
)

app.all('/api/v1/*', async (c) => {
  const result = await rpcHandler.handle(c.req.raw, {
    prefix: '/api/v1',
    context: await createAppContext(c),
  })

  if (!result.matched) {
    return c.notFound()
  }

  return result.response
})

/**
 * Cloudflare Worker 运行时默认导出。
 *
 * 说明：
 * - P6-T3 需要让同一份 Hono app 同时支持 Node 自托管与 Cloudflare Workers dry-run
 * - Node 专属启动逻辑仍保留在 `import.meta.main` 分支中，不污染 Edge 入口
 */
export default app

if (import.meta.main) {
  // 仅在 Node 直接启动时按需加载 node-server，避免 Cloudflare 打包时引入无关运行时代码。
  const { serve } = await import('@hono/node-server')
  const port = Number.parseInt(process.env.PORT ?? '3001', 10)
  serve(
    {
      fetch: app.fetch,
      port,
    },
    (info) => {
      console.log(`AI Native OS API listening on http://localhost:${info.port}`)
    },
  )
}
