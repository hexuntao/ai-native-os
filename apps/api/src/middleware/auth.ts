import { type AuthSession, auth, getAuthSession } from '@ai-native-os/auth'
import { loadUserPermissionProfileByEmail, writeOperationLog } from '@ai-native-os/db'
import { type AppAbility, defineAbilityFor, type PermissionRule } from '@ai-native-os/shared'
import type { Context } from 'hono'
import { createMiddleware } from 'hono/factory'

export interface ApiVariables {
  ability: AppAbility
  authSession: AuthSession | null
  permissionRules: PermissionRule[]
  rbacUserId: string | null
  roleCodes: string[]
}

export interface ApiEnv {
  Variables: ApiVariables
}

export interface ResolvedAuthContext extends ApiVariables {
  authSession: AuthSession | null
}

type AuthOperationAction = 'create_session' | 'create_user' | 'delete_session'

interface AuthOperationDefinition {
  action: AuthOperationAction
  detailLabel: string
}

function resolveAuthOperationDefinition(
  path: string,
  method: string,
): AuthOperationDefinition | null {
  if (method !== 'POST') {
    return null
  }

  if (path === '/api/auth/sign-in/email') {
    return {
      action: 'create_session',
      detailLabel: 'sign-in',
    }
  }

  if (path === '/api/auth/sign-out') {
    return {
      action: 'delete_session',
      detailLabel: 'sign-out',
    }
  }

  if (path === '/api/auth/sign-up/email') {
    return {
      action: 'create_user',
      detailLabel: 'sign-up',
    }
  }

  return null
}

async function extractEmailFromAuthRequest(request: Request): Promise<string | null> {
  const contentType = request.headers.get('content-type') ?? ''

  try {
    if (contentType.includes('application/json')) {
      const payload = (await request.json()) as {
        email?: unknown
      }

      return typeof payload.email === 'string' ? payload.email : null
    }

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData()
      const email = formData.get('email')

      return typeof email === 'string' ? email : null
    }
  } catch {
    return null
  }

  return null
}

async function readAuthErrorMessage(response: Response): Promise<string | null> {
  try {
    const payload = (await response.json()) as {
      error?: unknown
      message?: unknown
    }

    if (typeof payload.message === 'string' && payload.message) {
      return payload.message
    }

    if (typeof payload.error === 'string' && payload.error) {
      return payload.error
    }
  } catch {
    return null
  }

  return null
}

function buildAuthOperationDetail(
  definition: AuthOperationDefinition,
  email: string | null,
  responseStatus: number,
  status: 'error' | 'success',
): string {
  const emailLabel = email ?? 'unknown-user'

  if (status === 'success') {
    return `Better Auth ${definition.detailLabel} succeeded for ${emailLabel}.`
  }

  return `Better Auth ${definition.detailLabel} failed for ${emailLabel} with status ${responseStatus}.`
}

/**
 * 包装 Better Auth 原生 handler，并把当前仓库已存在的认证写路径接入 operation log。
 *
 * 审计边界：
 * - 只覆盖 sign-up / sign-in / sign-out 这些当前真实存在的写路径
 * - operation log 采用 best-effort 写入，避免日志故障反向打断认证主流程
 */
export async function handleAuditedAuthRequest<TEnv extends ApiEnv>(
  c: Context<TEnv>,
): Promise<Response> {
  const operationDefinition = resolveAuthOperationDefinition(c.req.path, c.req.method)

  if (!operationDefinition) {
    return auth.handler(c.req.raw)
  }

  const request = c.req.raw
  const authSessionBefore =
    operationDefinition.action === 'delete_session' ? await getAuthSession(request.headers) : null
  const emailFromRequest = await extractEmailFromAuthRequest(request.clone())
  const actorEmail = emailFromRequest ?? authSessionBefore?.user.email ?? null
  const response = await auth.handler(request)
  const permissionProfile = actorEmail ? await loadUserPermissionProfileByEmail(actorEmail) : null
  const requestId = response.headers.get('x-request-id') ?? crypto.randomUUID()
  const operationStatus = response.ok ? 'success' : 'error'
  const errorMessage =
    operationStatus === 'error'
      ? ((await readAuthErrorMessage(response.clone())) ?? `HTTP ${response.status}`)
      : null

  try {
    await writeOperationLog({
      action: operationDefinition.action,
      detail: buildAuthOperationDetail(
        operationDefinition,
        actorEmail,
        response.status,
        operationStatus,
      ),
      errorMessage,
      module: 'auth',
      operatorId: permissionProfile?.userId ?? null,
      requestInfo: {
        authPath: c.req.path,
        method: c.req.method,
        requestId,
        userEmail: actorEmail ?? null,
      },
      status: operationStatus,
      targetId: permissionProfile?.userId ?? null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    console.error(`Failed to persist auth operation log: ${message}`)
  }

  return response
}

// 统一解析 Better Auth 会话与 RBAC 权限，避免 API 与 Mastra 维护两套认证上下文逻辑。
export async function resolveAuthContext(headers: Headers): Promise<ResolvedAuthContext> {
  const authSession = await getAuthSession(headers)
  const permissionProfile = authSession?.user.email
    ? await loadUserPermissionProfileByEmail(authSession.user.email)
    : null
  const permissionRules = permissionProfile?.rules ?? []
  const ability = defineAbilityFor(permissionRules)

  return {
    ability,
    authSession,
    permissionRules,
    rbacUserId: permissionProfile?.userId ?? null,
    roleCodes: permissionProfile?.roleCodes ?? [],
  }
}

// 将解析后的认证结果回填到 Hono 上下文，供 oRPC 与 Mastra 共享。
export function applyResolvedAuthContext<TEnv extends ApiEnv>(
  c: Context<TEnv>,
  resolvedAuthContext: ResolvedAuthContext,
): void {
  c.set('ability', resolvedAuthContext.ability)
  c.set('authSession', resolvedAuthContext.authSession)
  c.set('permissionRules', resolvedAuthContext.permissionRules)
  c.set('rbacUserId', resolvedAuthContext.rbacUserId)
  c.set('roleCodes', resolvedAuthContext.roleCodes)
}

export const authSessionMiddleware = createMiddleware<ApiEnv>(async (c, next) => {
  const resolvedAuthContext = await resolveAuthContext(c.req.raw.headers)

  applyResolvedAuthContext(c, resolvedAuthContext)

  await next()
})

export async function handleAuthRequest(request: Request): Promise<Response> {
  return auth.handler(request)
}
