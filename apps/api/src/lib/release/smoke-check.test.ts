import assert from 'node:assert/strict'
import test from 'node:test'

import {
  type ReleaseSmokeEnvironment,
  resolveReleaseSmokeEnvironment,
  runReleaseSmokeChecks,
} from './smoke-check'

/**
 * 根据 URL 返回固定响应，供 smoke 测试复用。
 */
function createFetchStub(responses: ReadonlyMap<string, Response>): typeof globalThis.fetch {
  return async (input: string | URL | Request): Promise<Response> => {
    const url = input instanceof Request ? input.url : input.toString()
    const matchedResponse = responses.get(url)

    if (!matchedResponse) {
      throw new Error(`Unexpected fetch URL: ${url}`)
    }

    return matchedResponse.clone()
  }
}

/**
 * 构造完整可通过的发布 smoke 环境。
 */
function createSmokeEnvironment(): ReleaseSmokeEnvironment {
  return {
    apiBaseUrl: 'https://api.example.com',
    appBaseUrl: 'https://app.example.com',
    includeJobs: true,
    jobsHealthUrl: 'https://jobs.example.com/health',
    timeoutMs: 3000,
  }
}

test('resolveReleaseSmokeEnvironment keeps local defaults when no overrides exist', () => {
  const environment = resolveReleaseSmokeEnvironment({})

  assert.equal(environment.appBaseUrl, 'http://localhost:3000')
  assert.equal(environment.apiBaseUrl, 'http://localhost:3001')
  assert.equal(environment.includeJobs, false)
  assert.equal(environment.jobsHealthUrl, null)
  assert.equal(environment.timeoutMs, 15000)
})

test('resolveReleaseSmokeEnvironment honors release overrides and jobs health URL', () => {
  const environment = resolveReleaseSmokeEnvironment({
    APP_URL: 'https://ignored.example.com',
    API_URL: 'https://ignored-api.example.com',
    JOBS_HEALTH_URL: 'https://jobs.example.com',
    RELEASE_API_URL: 'https://api.example.com',
    RELEASE_APP_URL: 'https://app.example.com/',
    RELEASE_INCLUDE_JOBS: 'true',
    RELEASE_TIMEOUT_MS: '9000',
  })

  assert.equal(environment.appBaseUrl, 'https://app.example.com')
  assert.equal(environment.apiBaseUrl, 'https://api.example.com')
  assert.equal(environment.includeJobs, true)
  assert.equal(environment.jobsHealthUrl, 'https://jobs.example.com/health')
  assert.equal(environment.timeoutMs, 9000)
})

test('runReleaseSmokeChecks validates app, api, and jobs endpoints', async () => {
  const environment = createSmokeEnvironment()
  const fetcher = createFetchStub(
    new Map([
      [
        'https://api.example.com/health',
        Response.json({
          checks: {
            api: 'ok',
            ai: {
              copilot: 'degraded',
              defaultModel: 'openai/gpt-4.1-mini',
              embeddingProvider: 'deterministic-local',
              openaiApiKeyConfigured: false,
              reason:
                'OPENAI_API_KEY is missing; Copilot and remote embedding capabilities are disabled until a real upstream model key is configured.',
              remoteEmbeddings: 'degraded',
              status: 'degraded',
              unavailableSurfaces: ['copilot', 'remote-embeddings'],
            },
            database: 'ok',
            redis: 'unknown',
            telemetry: {
              openTelemetry: 'unknown',
              sentry: 'unknown',
            },
          },
          status: 'ok',
          timestamp: '2026-04-02T12:00:00.000Z',
        }),
      ],
      [
        'https://api.example.com/api/v1/system/ping',
        Response.json({
          json: {
            ok: true,
            service: 'api',
            timestamp: '2026-04-02T12:00:00.000Z',
          },
        }),
      ],
      [
        'https://app.example.com/healthz',
        Response.json({
          service: '@ai-native-os/web',
          status: 'ok',
          timestamp: '2026-04-02T12:00:00.000Z',
        }),
      ],
      [
        'https://app.example.com/',
        new Response('<!DOCTYPE html><html><body>ok</body></html>', {
          headers: {
            'content-type': 'text/html; charset=utf-8',
          },
          status: 200,
        }),
      ],
      [
        'https://jobs.example.com/health',
        Response.json({
          runtime: {
            name: '@ai-native-os/jobs',
            scheduledTaskIds: ['report-schedule-trigger'],
            status: 'workflow-orchestration-ready',
            taskIds: ['rag-indexing'],
            triggerConfigPath: 'apps/jobs/trigger.config.ts',
          },
          service: '@ai-native-os/jobs',
          status: 'ok',
          timestamp: '2026-04-02T12:00:00.000Z',
        }),
      ],
    ]),
  )

  const summary = await runReleaseSmokeChecks(environment, {
    fetcher,
    now: () => new Date('2026-04-02T12:00:00.000Z'),
  })

  assert.equal(summary.status, 'ok')
  assert.equal(summary.results.length, 5)
  assert.equal(summary.warnings.length, 4)
  assert.deepEqual(
    summary.results.map((result) => result.name),
    ['api-health', 'api-ping', 'web-health', 'web-root', 'jobs-health'],
  )
})

test('runReleaseSmokeChecks fails when the API database check is not healthy', async () => {
  const environment = {
    ...createSmokeEnvironment(),
    includeJobs: false,
    jobsHealthUrl: null,
  }
  const fetcher = createFetchStub(
    new Map([
      [
        'https://api.example.com/health',
        Response.json({
          checks: {
            api: 'ok',
            ai: {
              copilot: 'degraded',
              defaultModel: 'openai/gpt-4.1-mini',
              embeddingProvider: 'deterministic-local',
              openaiApiKeyConfigured: false,
              reason:
                'OPENAI_API_KEY is missing; Copilot and remote embedding capabilities are disabled until a real upstream model key is configured.',
              remoteEmbeddings: 'degraded',
              status: 'degraded',
              unavailableSurfaces: ['copilot', 'remote-embeddings'],
            },
            database: 'error',
            redis: 'unknown',
            telemetry: {
              openTelemetry: 'unknown',
              sentry: 'unknown',
            },
          },
          status: 'degraded',
          timestamp: '2026-04-02T12:00:00.000Z',
        }),
      ],
      [
        'https://api.example.com/api/v1/system/ping',
        Response.json({
          json: {
            ok: true,
            service: 'api',
            timestamp: '2026-04-02T12:00:00.000Z',
          },
        }),
      ],
      [
        'https://app.example.com/healthz',
        Response.json({
          service: '@ai-native-os/web',
          status: 'ok',
          timestamp: '2026-04-02T12:00:00.000Z',
        }),
      ],
      [
        'https://app.example.com/',
        new Response('<html><body>ok</body></html>', {
          headers: {
            'content-type': 'text/html; charset=utf-8',
          },
          status: 200,
        }),
      ],
    ]),
  )

  await assert.rejects(
    runReleaseSmokeChecks(environment, {
      fetcher,
      now: () => new Date('2026-04-02T12:00:00.000Z'),
    }),
    /API database health must be ok/,
  )
})

test('runReleaseSmokeChecks reports probe context when jobs health is unreachable', async () => {
  const environment = createSmokeEnvironment()
  const fetcher = createFetchStub(
    new Map([
      [
        'https://api.example.com/health',
        Response.json({
          checks: {
            api: 'ok',
            ai: {
              copilot: 'degraded',
              defaultModel: 'openai/gpt-4.1-mini',
              embeddingProvider: 'deterministic-local',
              openaiApiKeyConfigured: false,
              reason:
                'OPENAI_API_KEY is missing; Copilot and remote embedding capabilities are disabled until a real upstream model key is configured.',
              remoteEmbeddings: 'degraded',
              status: 'degraded',
              unavailableSurfaces: ['copilot', 'remote-embeddings'],
            },
            database: 'ok',
            redis: 'unknown',
            telemetry: {
              openTelemetry: 'unknown',
              sentry: 'unknown',
            },
          },
          status: 'ok',
          timestamp: '2026-04-02T12:00:00.000Z',
        }),
      ],
      [
        'https://api.example.com/api/v1/system/ping',
        Response.json({
          json: {
            ok: true,
            service: 'api',
            timestamp: '2026-04-02T12:00:00.000Z',
          },
        }),
      ],
      [
        'https://app.example.com/healthz',
        Response.json({
          service: '@ai-native-os/web',
          status: 'ok',
          timestamp: '2026-04-02T12:00:00.000Z',
        }),
      ],
      [
        'https://app.example.com/',
        new Response('<html><body>ok</body></html>', {
          headers: {
            'content-type': 'text/html; charset=utf-8',
          },
          status: 200,
        }),
      ],
    ]),
  )

  await assert.rejects(
    runReleaseSmokeChecks(environment, {
      fetcher,
      now: () => new Date('2026-04-02T12:00:00.000Z'),
    }),
    /Smoke probe "jobs-health" failed for https:\/\/jobs\.example\.com\/health: Unexpected fetch URL/,
  )
})

test('runReleaseSmokeChecks executes probes sequentially to avoid cold-start contention', async () => {
  const environment = createSmokeEnvironment()
  const callOrder: string[] = []
  const fetcher: typeof globalThis.fetch = async (
    input: string | URL | Request,
  ): Promise<Response> => {
    const url = input instanceof Request ? input.url : input.toString()
    callOrder.push(url)

    switch (url) {
      case 'https://api.example.com/health':
        return Response.json({
          checks: {
            api: 'ok',
            ai: {
              copilot: 'degraded',
              defaultModel: 'openai/gpt-4.1-mini',
              embeddingProvider: 'deterministic-local',
              openaiApiKeyConfigured: false,
              reason:
                'OPENAI_API_KEY is missing; Copilot and remote embedding capabilities are disabled until a real upstream model key is configured.',
              remoteEmbeddings: 'degraded',
              status: 'degraded',
              unavailableSurfaces: ['copilot', 'remote-embeddings'],
            },
            database: 'ok',
            redis: 'unknown',
            telemetry: {
              openTelemetry: 'unknown',
              sentry: 'unknown',
            },
          },
          status: 'ok',
          timestamp: '2026-04-02T12:00:00.000Z',
        })
      case 'https://api.example.com/api/v1/system/ping':
        assert.deepEqual(callOrder, ['https://api.example.com/health', url])
        return Response.json({
          json: {
            ok: true,
            service: 'api',
            timestamp: '2026-04-02T12:00:00.000Z',
          },
        })
      case 'https://app.example.com/healthz':
        assert.deepEqual(callOrder, [
          'https://api.example.com/health',
          'https://api.example.com/api/v1/system/ping',
          url,
        ])
        return Response.json({
          service: '@ai-native-os/web',
          status: 'ok',
          timestamp: '2026-04-02T12:00:00.000Z',
        })
      case 'https://app.example.com/':
        assert.deepEqual(callOrder, [
          'https://api.example.com/health',
          'https://api.example.com/api/v1/system/ping',
          'https://app.example.com/healthz',
          url,
        ])
        return new Response('<!DOCTYPE html><html><body>ok</body></html>', {
          headers: {
            'content-type': 'text/html; charset=utf-8',
          },
          status: 200,
        })
      case 'https://jobs.example.com/health':
        assert.deepEqual(callOrder, [
          'https://api.example.com/health',
          'https://api.example.com/api/v1/system/ping',
          'https://app.example.com/healthz',
          'https://app.example.com/',
          url,
        ])
        return Response.json({
          runtime: {
            name: '@ai-native-os/jobs',
            scheduledTaskIds: ['report-schedule-trigger'],
            status: 'workflow-orchestration-ready',
            taskIds: ['rag-indexing'],
            triggerConfigPath: 'apps/jobs/trigger.config.ts',
          },
          service: '@ai-native-os/jobs',
          status: 'ok',
          timestamp: '2026-04-02T12:00:00.000Z',
        })
      default:
        throw new Error(`Unexpected fetch URL: ${url}`)
    }
  }

  const summary = await runReleaseSmokeChecks(environment, {
    fetcher,
    now: () => new Date('2026-04-02T12:00:00.000Z'),
  })

  assert.deepEqual(
    summary.results.map((result) => result.name),
    ['api-health', 'api-ping', 'web-health', 'web-root', 'jobs-health'],
  )
})
