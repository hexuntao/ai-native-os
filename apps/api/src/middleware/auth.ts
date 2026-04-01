import { type AuthSession, auth, getAuthSession } from '@ai-native-os/auth'
import { createMiddleware } from 'hono/factory'

export interface ApiVariables {
  authSession: AuthSession | null
}

export interface ApiEnv {
  Variables: ApiVariables
}

export const authSessionMiddleware = createMiddleware<ApiEnv>(async (c, next) => {
  const authSession = await getAuthSession(c.req.raw.headers)

  c.set('authSession', authSession)

  await next()
})

export async function handleAuthRequest(request: Request): Promise<Response> {
  return auth.handler(request)
}
