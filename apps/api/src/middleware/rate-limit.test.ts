import assert from 'node:assert/strict'
import test from 'node:test'

import { ErrorCodes } from '@ai-native-os/shared'
import { Hono } from 'hono'
import { requestId } from 'hono/request-id'

import {
  type ApiRateLimitDependencies,
  type ApiRateLimitEnvironment,
  createApiRateLimitMiddleware,
  resolveApiRateLimitEnvironment,
} from './rate-limit'

/**
 * 构造可复用的限流测试应用。
 */
function createRateLimitedTestApp(
  environment: ApiRateLimitEnvironment,
  dependencies: ApiRateLimitDependencies,
): Hono {
  const app = new Hono()

  app.use('*', requestId({ headerName: 'x-request-id' }))
  app.use('*', createApiRateLimitMiddleware(environment, dependencies))
  app.get('/health', (context) => context.json({ ok: true }))
  app.get('/api/v1/demo', (context) => context.json({ ok: true }))
  app.post('/api/v1/ai/prompts/activate', (context) => context.json({ ok: true }))
  app.post('/api/auth/sign-in/email', (context) => context.json({ ok: true }))
  app.delete('/api/v1/system/config/demo', (context) => context.json({ ok: true }))

  return app
}

/**
 * 读取 JSON 响应体，避免测试中重复解析逻辑。
 */
async function readJsonBody(response: Response): Promise<unknown> {
  return response.json()
}

/**
 * 构造一个启用限流的测试环境。
 */
function createEnabledRateLimitEnvironment(): ApiRateLimitEnvironment {
  return {
    aiCommandMaxRequests: 1,
    aiCommandWindowMs: 60_000,
    authMaxRequests: 1,
    authWindowMs: 60_000,
    enabled: true,
    exemptPathPrefixes: ['/health'],
    generalMaxRequests: 1,
    generalWindowMs: 60_000,
    systemWriteMaxRequests: 1,
    systemWriteWindowMs: 60_000,
  }
}

test('resolveApiRateLimitEnvironment enables production baseline and keeps test disabled by default', () => {
  const productionEnvironment = resolveApiRateLimitEnvironment({
    NODE_ENV: 'production',
  })
  const testEnvironment = resolveApiRateLimitEnvironment({
    NODE_ENV: 'test',
  })

  assert.equal(productionEnvironment.enabled, true)
  assert.equal(productionEnvironment.generalMaxRequests, 120)
  assert.equal(productionEnvironment.authMaxRequests, 20)
  assert.equal(testEnvironment.enabled, false)
})

test('createApiRateLimitMiddleware returns 429 after the configured threshold is exceeded', async () => {
  let nowMs = 0
  const app = createRateLimitedTestApp(createEnabledRateLimitEnvironment(), {
    now: () => nowMs,
    store: new Map<string, { count: number; resetAt: number }>(),
  })

  const firstResponse = await app.request('http://localhost/api/v1/demo', {
    headers: {
      'x-forwarded-for': '203.0.113.10',
    },
  })
  const secondResponse = await app.request('http://localhost/api/v1/demo', {
    headers: {
      'x-forwarded-for': '203.0.113.10',
    },
  })

  assert.equal(firstResponse.status, 200)
  assert.equal(secondResponse.status, 429)
  assert.deepEqual(await readJsonBody(secondResponse), {
    code: 'RATE_LIMITED',
    errorCode: ErrorCodes.RATE_LIMITED.code,
    message: ErrorCodes.RATE_LIMITED.message,
    requestId: secondResponse.headers.get('x-request-id') ?? undefined,
    retryAfterSeconds: 60,
    status: 429,
  })
  assert.equal(secondResponse.headers.get('retry-after'), '60')
  assert.equal(secondResponse.headers.get('x-ratelimit-limit'), '1')
  assert.equal(secondResponse.headers.get('x-ratelimit-remaining'), '0')

  nowMs = 60_000

  const resetResponse = await app.request('http://localhost/api/v1/demo', {
    headers: {
      'x-forwarded-for': '203.0.113.10',
    },
  })

  assert.equal(resetResponse.status, 200)
})

test('createApiRateLimitMiddleware keeps health probes exempt and uses stricter auth buckets', async () => {
  const app = createRateLimitedTestApp(createEnabledRateLimitEnvironment(), {
    now: () => 0,
    store: new Map<string, { count: number; resetAt: number }>(),
  })

  const firstHealthResponse = await app.request('http://localhost/health', {
    headers: {
      'x-forwarded-for': '198.51.100.1',
    },
  })
  const secondHealthResponse = await app.request('http://localhost/health', {
    headers: {
      'x-forwarded-for': '198.51.100.1',
    },
  })
  const firstAuthResponse = await app.request('http://localhost/api/auth/sign-in/email', {
    headers: {
      'x-forwarded-for': '198.51.100.1',
    },
    method: 'POST',
  })
  const secondAuthResponse = await app.request('http://localhost/api/auth/sign-in/email', {
    headers: {
      'x-forwarded-for': '198.51.100.1',
    },
    method: 'POST',
  })

  assert.equal(firstHealthResponse.status, 200)
  assert.equal(secondHealthResponse.status, 200)
  assert.equal(firstAuthResponse.status, 200)
  assert.equal(secondAuthResponse.status, 429)
})

test('createApiRateLimitMiddleware applies dedicated buckets for AI command writes and system writes', async () => {
  const app = createRateLimitedTestApp(
    {
      aiCommandMaxRequests: 1,
      aiCommandWindowMs: 60_000,
      authMaxRequests: 5,
      authWindowMs: 60_000,
      enabled: true,
      exemptPathPrefixes: ['/health'],
      generalMaxRequests: 3,
      generalWindowMs: 60_000,
      systemWriteMaxRequests: 1,
      systemWriteWindowMs: 60_000,
    },
    {
      now: () => 0,
      store: new Map<string, { count: number; resetAt: number }>(),
    },
  )

  const firstAiCommandResponse = await app.request('http://localhost/api/v1/ai/prompts/activate', {
    headers: {
      'x-forwarded-for': '203.0.113.20',
    },
    method: 'POST',
  })
  const secondAiCommandResponse = await app.request('http://localhost/api/v1/ai/prompts/activate', {
    headers: {
      'x-forwarded-for': '203.0.113.20',
    },
    method: 'POST',
  })
  const firstSystemWriteResponse = await app.request('http://localhost/api/v1/system/config/demo', {
    headers: {
      'x-forwarded-for': '203.0.113.21',
    },
    method: 'DELETE',
  })
  const secondSystemWriteResponse = await app.request(
    'http://localhost/api/v1/system/config/demo',
    {
      headers: {
        'x-forwarded-for': '203.0.113.21',
      },
      method: 'DELETE',
    },
  )
  const generalReadResponse = await app.request('http://localhost/api/v1/demo', {
    headers: {
      'x-forwarded-for': '203.0.113.20',
    },
  })

  assert.equal(firstAiCommandResponse.status, 200)
  assert.equal(secondAiCommandResponse.status, 429)
  assert.equal(firstSystemWriteResponse.status, 200)
  assert.equal(secondSystemWriteResponse.status, 429)
  assert.equal(generalReadResponse.status, 200)
})
