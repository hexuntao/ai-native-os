import type { Context } from 'hono'

export interface AppContext {
  requestId: string
  userId: string | null
}

export function createAppContext(c: Context): AppContext {
  const requestIdHeader = c.req.header('x-request-id')

  return {
    requestId: requestIdHeader ?? crypto.randomUUID(),
    userId: null,
  }
}
