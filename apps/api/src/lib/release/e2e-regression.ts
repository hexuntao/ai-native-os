import { randomUUID } from 'node:crypto'

import { listAiAuditLogsByToolId } from '@ai-native-os/db'
import {
  type LocalBootstrapRoleCode,
  localBootstrapPassword,
  localBootstrapSubjects,
} from '@ai-native-os/shared'
import { serve } from '@hono/node-server'

import { app } from '../../index'
import { resolveAiRuntimeCapability } from '../../mastra/capabilities'
import { createExternalMcpClient, discoverExternalMcpSnapshot } from '../../mastra/mcp/client'
import { mastraMcpEndpointPath } from '../../mastra/mcp/server'
import { reportScheduleWorkflowOutputSchema } from '../../mastra/workflows/report-schedule'
import { type ReleasePreflightSummary, runReleasePreflight } from './preflight'

export type RegressionStepStatus = 'failed' | 'passed' | 'skipped'
export type ReleaseTrustLevel = 'high' | 'medium'
export type ReleaseSmokeMode = 'existing' | 'skip'

export interface RegressionStepResult {
  detail: string
  durationMs: number
  name: string
  status: RegressionStepStatus
  warnings: string[]
}

export interface FinalRegressionSummary {
  checkedAt: string
  releaseTrust: ReleaseTrustLevel
  status: 'passed'
  steps: RegressionStepResult[]
  warnings: string[]
}

export interface FinalRegressionEnvironment {
  releaseSmokeMode: ReleaseSmokeMode
}

export interface FinalRegressionDependencies {
  now: () => Date
  runReleasePreflight: () => Promise<ReleasePreflightSummary>
}

export class FinalRegressionError extends Error {
  summary: {
    checkedAt: string
    status: 'failed'
    steps: RegressionStepResult[]
    warnings: string[]
  }

  constructor(
    message: string,
    summary: {
      checkedAt: string
      status: 'failed'
      steps: RegressionStepResult[]
      warnings: string[]
    },
  ) {
    super(message)
    this.name = 'FinalRegressionError'
    this.summary = summary
  }
}

interface AuthenticatedPrincipalSession {
  headers: Headers
  roleCode: LocalBootstrapRoleCode
}

interface PrincipalSessionMap {
  admin: AuthenticatedPrincipalSession
  editor: AuthenticatedPrincipalSession
  super_admin: AuthenticatedPrincipalSession
  viewer: AuthenticatedPrincipalSession
}

interface TemporaryServerHandle {
  baseUrl: string
  close: () => Promise<void>
}

const defaultFinalRegressionDependencies: FinalRegressionDependencies = {
  now: () => new Date(),
  runReleasePreflight: () => runReleasePreflight(),
}

/**
 * 解析最终 E2E 回归环境，决定是否要求执行 release smoke。
 */
export function resolveFinalRegressionEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): FinalRegressionEnvironment {
  const normalizedMode = environment.E2E_RELEASE_SMOKE_MODE?.trim().toLowerCase()

  if (!normalizedMode) {
    return {
      releaseSmokeMode: 'existing',
    }
  }

  if (normalizedMode === 'existing' || normalizedMode === 'skip') {
    return {
      releaseSmokeMode: normalizedMode,
    }
  }

  throw new Error('E2E_RELEASE_SMOKE_MODE must be either "existing" or "skip"')
}

/**
 * 把 sign-in 响应里的 Set-Cookie 头收敛成后续请求可复用的 Cookie 头。
 */
function convertSetCookieToCookie(headers: Headers): Headers {
  const setCookieHeaders = headers.getSetCookie()

  if (setCookieHeaders.length === 0) {
    return headers
  }

  const existingCookies = headers.get('cookie')
  const cookies = existingCookies ? existingCookies.split('; ') : []

  for (const setCookie of setCookieHeaders) {
    const cookiePair = setCookie.split(';')[0]?.trim()

    if (cookiePair) {
      cookies.push(cookiePair)
    }
  }

  headers.set('cookie', cookies.join('; '))

  return headers
}

/**
 * 将 Headers 转成 MCP client 可消费的普通对象。
 */
function headersToRecord(headers: Headers): Record<string, string> {
  return Object.fromEntries(headers.entries())
}

/**
 * 读取本地 bootstrap 主体定义。
 */
function getBootstrapSubject(
  roleCode: LocalBootstrapRoleCode,
): (typeof localBootstrapSubjects)[number] {
  const subject = localBootstrapSubjects.find((candidate) => candidate.roleCode === roleCode)

  if (!subject) {
    throw new Error(`Missing bootstrap subject for role code ${roleCode}`)
  }

  return subject
}

/**
 * 解析 MCP tool 返回的文本 JSON 结果。
 */
function parseMcpToolJsonResult(result: unknown): unknown {
  if (
    typeof result === 'object' &&
    result !== null &&
    'toolResult' in result &&
    result.toolResult !== undefined
  ) {
    return result.toolResult
  }

  if (
    typeof result === 'object' &&
    result !== null &&
    'content' in result &&
    Array.isArray(result.content)
  ) {
    const textPart = result.content.find(
      (contentPart) =>
        typeof contentPart === 'object' &&
        contentPart !== null &&
        'type' in contentPart &&
        contentPart.type === 'text' &&
        'text' in contentPart &&
        typeof contentPart.text === 'string',
    )

    if (
      !textPart ||
      typeof textPart !== 'object' ||
      textPart === null ||
      !('text' in textPart) ||
      typeof textPart.text !== 'string'
    ) {
      throw new Error('Expected MCP tool result to expose a text content part')
    }

    return JSON.parse(textPart.text) as unknown
  }

  throw new Error('Unsupported MCP tool result payload')
}

/**
 * 为动态 MCP tool 执行生成最小调用上下文。
 */
function createMcpToolCallOptions(): {
  messages: []
  toolCallId: string
} {
  return {
    messages: [],
    toolCallId: randomUUID(),
  }
}

/**
 * 统一执行一个回归步骤并记录耗时。
 */
async function executeRegressionStep(
  name: string,
  operation: () => Promise<{
    detail: string
    status?: Exclude<RegressionStepStatus, 'failed'>
    warnings?: string[]
  }>,
): Promise<RegressionStepResult> {
  const startedAt = performance.now()

  try {
    const result = await operation()

    return {
      detail: result.detail,
      durationMs: Math.round(performance.now() - startedAt),
      name,
      status: result.status ?? 'passed',
      warnings: result.warnings ?? [],
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    return {
      detail: message,
      durationMs: Math.round(performance.now() - startedAt),
      name,
      status: 'failed',
      warnings: [],
    }
  }
}

/**
 * 使用默认 bootstrap 账号创建一个真实登录会话。
 */
async function signInBootstrapPrincipal(
  roleCode: LocalBootstrapRoleCode,
): Promise<AuthenticatedPrincipalSession> {
  const subject = getBootstrapSubject(roleCode)
  const origin = process.env.APP_URL?.trim() || 'http://localhost:3000'
  const signInResponse = await app.request('http://localhost/api/auth/sign-in/email', {
    body: JSON.stringify({
      email: subject.email,
      password: localBootstrapPassword,
      rememberMe: true,
    }),
    headers: {
      'content-type': 'application/json',
      origin,
    },
    method: 'POST',
  })

  if (signInResponse.status !== 200) {
    throw new Error(`Sign-in failed for ${roleCode} with status ${signInResponse.status}`)
  }

  const authHeaders = convertSetCookieToCookie(signInResponse.headers)

  authHeaders.set('origin', origin)

  return {
    headers: authHeaders,
    roleCode,
  }
}

/**
 * 为四类默认主体一次性建立登录会话。
 */
async function createPrincipalSessions(): Promise<PrincipalSessionMap> {
  const [viewer, admin, editor, superAdmin] = await Promise.all([
    signInBootstrapPrincipal('viewer'),
    signInBootstrapPrincipal('admin'),
    signInBootstrapPrincipal('editor'),
    signInBootstrapPrincipal('super_admin'),
  ])

  return {
    admin,
    editor,
    super_admin: superAdmin,
    viewer,
  }
}

/**
 * 启动仅供外部 MCP client 使用的临时 HTTP server。
 */
async function startTemporaryServer(): Promise<TemporaryServerHandle> {
  return await new Promise<TemporaryServerHandle>((resolvePromise, rejectPromise) => {
    const server = serve(
      {
        fetch: app.fetch,
        port: 0,
      },
      (info) => {
        resolvePromise({
          baseUrl: `http://127.0.0.1:${info.port}`,
          close: async () =>
            await new Promise<void>((closeResolve, closeReject) => {
              server.close((error?: Error) => {
                if (error) {
                  closeReject(error)
                  return
                }

                closeResolve()
              })
            }),
        })
      },
    )

    server.on('error', rejectPromise)
  })
}

/**
 * 验证默认 bootstrap 账号可以直接登录并读取 session。
 */
async function verifyBootstrapLogins(sessions: PrincipalSessionMap): Promise<{
  detail: string
}> {
  const verifiedRoles: LocalBootstrapRoleCode[] = []

  for (const session of Object.values(sessions)) {
    const response = await app.request('http://localhost/api/v1/system/session', {
      headers: session.headers,
      method: 'GET',
    })

    if (response.status !== 200) {
      throw new Error(`Session endpoint failed for ${session.roleCode} with ${response.status}`)
    }

    verifiedRoles.push(session.roleCode)
  }

  return {
    detail: `verified direct login for ${verifiedRoles.sort().join(', ')}`,
  }
}

/**
 * 验证 viewer 的只读面可访问，而写面仍被拒绝。
 */
async function verifyViewerSurface(session: AuthenticatedPrincipalSession): Promise<{
  detail: string
}> {
  const listResponse = await app.request('http://localhost/api/v1/system/users', {
    headers: session.headers,
    method: 'GET',
  })

  if (listResponse.status !== 200) {
    throw new Error(`Viewer list users failed with ${listResponse.status}`)
  }

  const createResponse = await app.request('http://localhost/api/v1/system/users', {
    body: JSON.stringify({
      email: `viewer-denied-${randomUUID()}@example.com`,
      password: localBootstrapPassword,
      roleCodes: ['viewer'],
      username: `viewer_denied_${randomUUID().slice(0, 8)}`,
    }),
    headers: {
      ...headersToRecord(session.headers),
      'content-type': 'application/json',
    },
    method: 'POST',
  })

  if (createResponse.status !== 403) {
    throw new Error(`Viewer create user should be forbidden, received ${createResponse.status}`)
  }

  return {
    detail: 'viewer kept read access and write denial on system/users',
  }
}

/**
 * 验证 admin 的 MCP discovery 不再暴露不可执行的 workflow wrapper。
 */
async function verifyAdminMcpDiscovery(
  session: AuthenticatedPrincipalSession,
  serverBaseUrl: string,
): Promise<{
  detail: string
}> {
  const snapshot = await discoverExternalMcpSnapshot({
    headers: headersToRecord(session.headers),
    url: `${serverBaseUrl}${mastraMcpEndpointPath}`,
  })

  if (snapshot.toolNames.length !== 1 || snapshot.toolNames[0] !== 'tool_user_directory') {
    throw new Error(`Admin MCP discovery drifted: ${snapshot.toolNames.join(', ')}`)
  }

  return {
    detail: 'admin only sees tool_user_directory in MCP discovery',
  }
}

/**
 * 验证 editor 可以通过 MCP 发现并执行报表 workflow。
 */
async function verifyEditorWorkflowExecution(
  session: AuthenticatedPrincipalSession,
  serverBaseUrl: string,
): Promise<{
  detail: string
}> {
  const client = await createExternalMcpClient({
    headers: headersToRecord(session.headers),
    url: `${serverBaseUrl}${mastraMcpEndpointPath}`,
  })

  try {
    const tools = await client.tools()

    if (!('run_report_schedule' in tools)) {
      throw new Error('Editor MCP discovery did not expose run_report_schedule')
    }

    const workflowResult = await tools.run_report_schedule.execute(
      {
        reportLabel: 'final-e2e-editor-report',
        triggerSource: 'test',
      },
      createMcpToolCallOptions(),
    )
    const parsedResult = reportScheduleWorkflowOutputSchema.parse(
      parseMcpToolJsonResult(workflowResult),
    )

    if (parsedResult.snapshot.counts.users <= 0) {
      throw new Error('Editor workflow execution returned an empty user snapshot count')
    }

    return {
      detail: `editor executed run_report_schedule with request ${parsedResult.requestId}`,
    }
  } finally {
    await client.close()
  }
}

/**
 * 验证 super admin 能读取 AI 审计日志，并且 workflow 审计已真实落库。
 */
async function verifySuperAdminAuditSurface(session: AuthenticatedPrincipalSession): Promise<{
  detail: string
}> {
  const auditResponse = await app.request('http://localhost/api/v1/system/ai/audit-logs/recent', {
    headers: session.headers,
    method: 'GET',
  })

  if (auditResponse.status !== 200) {
    throw new Error(`Super admin AI audit route failed with ${auditResponse.status}`)
  }

  const workflowAuditRows = await listAiAuditLogsByToolId('workflow:report-schedule')

  if (workflowAuditRows.length === 0) {
    throw new Error('Expected workflow:report-schedule audit rows after MCP execution')
  }

  return {
    detail: `super_admin read AI audit route and found ${workflowAuditRows.length} workflow audit rows`,
  }
}

/**
 * 验证当前 AI runtime capability 与 super admin 的 Copilot discovery 是否一致。
 */
async function verifyCopilotCapabilitySurface(session: AuthenticatedPrincipalSession): Promise<{
  detail: string
}> {
  const capability = resolveAiRuntimeCapability()
  const response = await app.request('http://localhost/api/ag-ui/runtime', {
    headers: session.headers,
    method: 'GET',
  })

  if (response.status !== 200) {
    throw new Error(`AG-UI runtime summary failed with ${response.status}`)
  }

  const payload = (await response.json()) as {
    agentIds?: string[]
    capability?: {
      status?: string
    }
  }
  const agentIds = Array.isArray(payload.agentIds) ? payload.agentIds : []

  if (capability.status === 'enabled') {
    if (!agentIds.includes('admin-copilot')) {
      throw new Error('Expected admin-copilot to be visible for super_admin when AI is enabled')
    }
  } else if (agentIds.length > 0) {
    throw new Error('Expected no Copilot agents to be visible while AI runtime is degraded')
  }

  return {
    detail: `copilot capability=${capability.status}, enabledAgents=${agentIds.join(', ') || 'none'}`,
  }
}

/**
 * 在应用内完成最终 E2E 运行时回归，不依赖外部浏览器或手工步骤。
 */
export async function runApplicationRegressionBundle(): Promise<RegressionStepResult[]> {
  const steps: RegressionStepResult[] = []
  const sessions = await createPrincipalSessions()
  const temporaryServer = await startTemporaryServer()

  try {
    steps.push(
      await executeRegressionStep('bootstrap-login', () => verifyBootstrapLogins(sessions)),
    )
    steps.push(
      await executeRegressionStep('viewer-surface', () => verifyViewerSurface(sessions.viewer)),
    )
    steps.push(
      await executeRegressionStep('admin-mcp-discovery', () =>
        verifyAdminMcpDiscovery(sessions.admin, temporaryServer.baseUrl),
      ),
    )
    steps.push(
      await executeRegressionStep('editor-mcp-workflow', () =>
        verifyEditorWorkflowExecution(sessions.editor, temporaryServer.baseUrl),
      ),
    )
    steps.push(
      await executeRegressionStep('super-admin-ai-audit', () =>
        verifySuperAdminAuditSurface(sessions.super_admin),
      ),
    )
    steps.push(
      await executeRegressionStep('copilot-capability-surface', () =>
        verifyCopilotCapabilitySurface(sessions.super_admin),
      ),
    )

    return steps
  } finally {
    await temporaryServer.close()
  }
}

/**
 * 运行最终回归所需的发布预检，或在显式跳过时留下可审计记录。
 */
export async function runReleaseSmokeRegressionStep(
  environment: FinalRegressionEnvironment,
  dependencies: FinalRegressionDependencies = defaultFinalRegressionDependencies,
): Promise<RegressionStepResult> {
  return await executeRegressionStep('release-smoke', async () => {
    if (environment.releaseSmokeMode === 'skip') {
      return {
        detail: 'release smoke skipped by E2E_RELEASE_SMOKE_MODE=skip',
        status: 'skipped',
      }
    }

    const summary = await dependencies.runReleasePreflight()
    const backupLabel =
      summary.backupVerification.status === 'passed'
        ? 'backup=passed'
        : `backup=${summary.backupVerification.status}`

    return {
      detail: `status=${summary.status}, ${backupLabel}, probes=${summary.releaseSmoke.results.length}`,
      warnings: summary.warnings,
    }
  })
}

/**
 * 汇总最终回归步骤并计算当前发布信任等级。
 */
export function finalizeRegressionSummary(
  steps: RegressionStepResult[],
  dependencies: Pick<FinalRegressionDependencies, 'now'> = defaultFinalRegressionDependencies,
): FinalRegressionSummary {
  const failedSteps = steps.filter((step) => step.status === 'failed')
  const warnings = steps.flatMap((step) => step.warnings)

  if (failedSteps.length > 0) {
    throw new FinalRegressionError(`Final regression failed at step ${failedSteps[0]?.name}`, {
      checkedAt: dependencies.now().toISOString(),
      status: 'failed',
      steps,
      warnings,
    })
  }

  const releaseTrust: ReleaseTrustLevel = steps.some((step) => step.status === 'skipped')
    ? 'medium'
    : 'high'

  return {
    checkedAt: dependencies.now().toISOString(),
    releaseTrust,
    status: 'passed',
    steps,
    warnings,
  }
}
