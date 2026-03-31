import assert from 'node:assert/strict'
import test from 'node:test'

import { app } from './index'

test('health endpoint responds without crashing the app', async () => {
  const response = await app.request('http://localhost/health')
  const payload = (await response.json()) as {
    checks: { api: string; database: string; redis: string }
    status: string
  }

  assert.ok(response.status === 200 || response.status === 503)
  assert.equal(payload.checks.api, 'ok')
  assert.ok(['ok', 'degraded'].includes(payload.status))
})

test('ping endpoint returns the initial oRPC payload', async () => {
  const response = await app.request('http://localhost/api/v1/system/ping')
  const payload = (await response.json()) as {
    json: { ok: boolean; service: string; timestamp: string }
  }

  assert.equal(response.status, 200)
  assert.equal(payload.json.ok, true)
  assert.equal(payload.json.service, 'api')
})
