import { type AuthSession, auth, getAuthSession } from '@ai-native-os/auth'
import { loadUserPermissionProfileByEmail } from '@ai-native-os/db'
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
