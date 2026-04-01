import type { AuthSession } from '@ai-native-os/auth'
import type { Context } from 'hono'

import type { ApiEnv } from '@/middleware/auth'

export interface AppContext {
  requestId: string
  session: AuthSession | null
  userId: string | null
}

export async function createAppContext(c: Context<ApiEnv>): Promise<AppContext> {
  const requestIdHeader = c.req.header('x-request-id')
  const authSession = c.get('authSession')

  return {
    requestId: requestIdHeader ?? crypto.randomUUID(),
    session: authSession,
    userId: authSession?.user.id ?? null,
  }
}
