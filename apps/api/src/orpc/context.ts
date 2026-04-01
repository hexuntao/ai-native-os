import type { AuthSession } from '@ai-native-os/auth'
import type { AppAbility, PermissionRule } from '@ai-native-os/shared'
import type { Context } from 'hono'

import type { ApiEnv } from '@/middleware/auth'

export interface AppContext {
  ability: AppAbility
  permissionRules: PermissionRule[]
  requestId: string
  rbacUserId: string | null
  roleCodes: string[]
  session: AuthSession | null
  userId: string | null
}

export async function createAppContext<TEnv extends ApiEnv>(c: Context<TEnv>): Promise<AppContext> {
  const authSession = c.get('authSession')

  return {
    ability: c.get('ability'),
    permissionRules: c.get('permissionRules'),
    requestId: c.get('requestId'),
    rbacUserId: c.get('rbacUserId'),
    roleCodes: c.get('roleCodes'),
    session: authSession,
    userId: authSession?.user.id ?? null,
  }
}
