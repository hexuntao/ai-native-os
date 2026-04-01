import { db } from '@ai-native-os/db'
import { healthResponseSchema } from '@ai-native-os/shared'
import { serve } from '@hono/node-server'
import { RPCHandler } from '@orpc/server/fetch'
import { Scalar } from '@scalar/hono-api-reference'
import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { requestId } from 'hono/request-id'
import { secureHeaders } from 'hono/secure-headers'

import { generateOpenApiDocument } from '@/lib/openapi'
import { type ApiEnv, authSessionMiddleware, handleAuthRequest } from '@/middleware/auth'
import { createAppContext } from '@/orpc/context'
import { appRouter } from '@/routes'

const rpcHandler = new RPCHandler(appRouter)

export const app = new Hono<ApiEnv>()

app.use('*', secureHeaders())
app.use(
  '*',
  cors({
    origin: process.env.APP_URL ?? 'http://localhost:3000',
    credentials: true,
  }),
)
app.use('*', requestId())
app.use('*', async (c, next) => {
  const start = Date.now()
  await next()
  const durationMs = Date.now() - start
  console.log(`${c.req.method} ${c.req.path} ${c.res.status} ${durationMs}ms`)
})

app.get('/health', async (c) => {
  let database: 'ok' | 'error' = 'ok'

  try {
    await db.execute(sql`select 1`)
  } catch {
    database = 'error'
  }

  const payload = {
    status: database === 'ok' ? 'ok' : 'degraded',
    checks: {
      api: 'ok',
      database,
      redis: 'unknown',
    },
    timestamp: new Date().toISOString(),
  } as const

  const response = healthResponseSchema.parse(payload)

  return c.json(response, database === 'ok' ? 200 : 503)
})

app.get('/api/openapi.json', async (c) => {
  const document = await generateOpenApiDocument()
  return c.json(document)
})

app.get(
  '/api/docs',
  Scalar({
    url: '/api/openapi.json',
    pageTitle: 'AI Native OS API',
    theme: 'kepler',
  }),
)

app.all('/api/auth/*', async (c) => handleAuthRequest(c.req.raw))

app.use('/api/v1/*', authSessionMiddleware)

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
