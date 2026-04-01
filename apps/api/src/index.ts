import {
  type AppActions,
  type AppSubjects,
  aiAuditListResponseSchema,
  aiEvalListResponseSchema,
  aiFeedbackEntrySchema,
  aiFeedbackListResponseSchema,
  createAiFeedbackInputSchema,
  currentPermissionsResponseSchema,
  healthResponseSchema,
  knowledgeListResponseSchema,
  listAiAuditLogsInputSchema,
  listAiEvalsInputSchema,
  listAiFeedbackInputSchema,
  listKnowledgeInputSchema,
  listMenusInputSchema,
  listOnlineUsersInputSchema,
  listOperationLogsInputSchema,
  listPermissionsInputSchema,
  listRolesInputSchema,
  listUsersInputSchema,
  menuListResponseSchema,
  onlineUserListResponseSchema,
  operationLogListResponseSchema,
  permissionListResponseSchema,
  roleListResponseSchema,
  serializedAbilityResponseSchema,
  userListResponseSchema,
} from '@ai-native-os/shared'
import { serve } from '@hono/node-server'
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
import { getApiHealthSnapshot } from '@/lib/health'
import { generateOpenApiDocument } from '@/lib/openapi'
import { initializeTelemetry } from '@/lib/telemetry'
import { getMastraRuntimeSummary, mastra, mastraEnvironment } from '@/mastra'
import { handleMastraMcpRequest, mastraMcpEndpointPath } from '@/mastra/mcp/server'
import { readMastraRequestContext } from '@/mastra/request-context'
import { SecureMastraServer } from '@/mastra/server'
import { type ApiEnv, authSessionMiddleware, handleAuditedAuthRequest } from '@/middleware/auth'
import { createAppContext } from '@/orpc/context'
import { appRouter } from '@/routes'
import { listAiAuditLogs } from '@/routes/ai/audit'
import { listAiEvals } from '@/routes/ai/evals'
import { createFeedback, listFeedback } from '@/routes/ai/feedback'
import { listKnowledge } from '@/routes/ai/knowledge'
import { listMonitorLogs } from '@/routes/monitor/logs'
import { listOnlineUsers } from '@/routes/monitor/online'
import { listMenus } from '@/routes/system/menus'
import { listPermissions } from '@/routes/system/permissions'
import { listRoles } from '@/routes/system/roles'
import { listUsers } from '@/routes/system/users'

const rpcHandler = new RPCHandler(appRouter)

interface AppEnv extends ApiEnv {
  Bindings: HonoBindings
  Variables: ApiEnv['Variables'] & HonoVariables
}

export const app = new Hono<AppEnv>()
initializeTelemetry()

const contractFirstReadRequirements = {
  aiAudit: [
    { action: 'read', subject: 'AiAuditLog' },
    { action: 'manage', subject: 'all' },
  ],
  aiFeedback: [
    { action: 'read', subject: 'AiAuditLog' },
    { action: 'manage', subject: 'all' },
  ],
  aiEvals: [
    { action: 'read', subject: 'AiAuditLog' },
    { action: 'manage', subject: 'AiKnowledge' },
  ],
  aiKnowledge: [
    { action: 'read', subject: 'AiKnowledge' },
    { action: 'manage', subject: 'AiKnowledge' },
  ],
  menus: [
    { action: 'read', subject: 'Menu' },
    { action: 'manage', subject: 'Menu' },
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

/**
 * 统一输出标准未认证响应，避免 REST 兼容入口与 oRPC 错误语义分叉。
 */
function jsonUnauthorized<TEnv extends AppEnv>(c: Context<TEnv>): Response {
  return c.json(
    {
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    },
    401,
  )
}

/**
 * 统一输出标准权限不足响应，确保兼容入口不会绕过现有 RBAC 边界。
 */
function jsonForbidden<TEnv extends AppEnv>(c: Context<TEnv>, message: string): Response {
  return c.json(
    {
      code: 'FORBIDDEN',
      message,
    },
    403,
  )
}

/**
 * 统一输出查询参数校验错误，确保 contract-first REST 请求得到稳定错误格式。
 */
function jsonBadRequest<TEnv extends AppEnv>(c: Context<TEnv>, error: z.ZodError): Response {
  return c.json(
    {
      code: 'BAD_REQUEST',
      issues: error.flatten(),
      message: 'Invalid query parameters',
    },
    400,
  )
}

/**
 * 复用 oRPC 错误语义，将 contract-first 兼容入口的业务异常映射为稳定 HTTP 响应。
 */
function jsonOrpcError<TEnv extends AppEnv>(
  c: Context<TEnv>,
  error: {
    code: string
    message: string
  },
): Response {
  if (error.code === 'UNAUTHORIZED') {
    return jsonUnauthorized(c)
  }

  if (error.code === 'FORBIDDEN') {
    return jsonForbidden(c, error.message)
  }

  if (error.code === 'BAD_REQUEST') {
    return c.json(
      {
        code: 'BAD_REQUEST',
        message: error.message,
      },
      400,
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

  const parsedInput = inputSchema.safeParse(c.req.query())

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
  const parsedInput = inputSchema.safeParse(requestJson)

  if (!parsedInput.success) {
    return jsonBadRequest(c, parsedInput.error)
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

app.get('/api/v1/system/roles', (c) =>
  handleContractFirstGet(
    c,
    listRolesInputSchema,
    roleListResponseSchema,
    contractFirstReadRequirements.roles,
    listRoles,
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

app.get('/api/v1/system/menus', (c) =>
  handleContractFirstGet(
    c,
    listMenusInputSchema,
    menuListResponseSchema,
    contractFirstReadRequirements.menus,
    listMenus,
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

app.get('/api/v1/ai/evals', (c) =>
  handleContractFirstGet(
    c,
    listAiEvalsInputSchema,
    aiEvalListResponseSchema,
    contractFirstReadRequirements.aiEvals,
    listAiEvals,
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

app.get('/api/v1/ai/feedback', (c) =>
  handleContractFirstGet(
    c,
    listAiFeedbackInputSchema,
    aiFeedbackListResponseSchema,
    contractFirstReadRequirements.aiFeedback,
    listFeedback,
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
        requestId: context.requestId,
      }),
  ),
)

app.get('/api/v1/system/permissions/current', async (c) => {
  const context = await createAppContext(c)

  if (!context.session) {
    return c.json(
      {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
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
      {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
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

if (import.meta.main) {
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
