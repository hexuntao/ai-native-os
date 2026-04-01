import { type AuthSession, auth, getAuthSession } from '@ai-native-os/auth'
import { loadUserPermissionProfileByEmail } from '@ai-native-os/db'
import { type AppAbility, defineAbilityFor, type PermissionRule } from '@ai-native-os/shared'
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

export const authSessionMiddleware = createMiddleware<ApiEnv>(async (c, next) => {
  const authSession = await getAuthSession(c.req.raw.headers)
  const permissionProfile = authSession?.user.email
    ? await loadUserPermissionProfileByEmail(authSession.user.email)
    : null
  const permissionRules = permissionProfile?.rules ?? []
  const ability = defineAbilityFor(permissionRules)

  c.set('ability', ability)
  c.set('authSession', authSession)
  c.set('permissionRules', permissionRules)
  c.set('rbacUserId', permissionProfile?.userId ?? null)
  c.set('roleCodes', permissionProfile?.roleCodes ?? [])

  await next()
})

export async function handleAuthRequest(request: Request): Promise<Response> {
  return auth.handler(request)
}
