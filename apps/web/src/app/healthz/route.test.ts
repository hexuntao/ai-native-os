import assert from 'node:assert/strict'
import test from 'node:test'

import { buildWebHealthPayload, GET } from './route'

/**
 * 读取 JSON 响应体并收窄为对象记录。
 */
async function readJsonRecord(response: Response): Promise<Record<string, unknown>> {
  const payload = JSON.parse(await response.text()) as unknown

  assert.equal(typeof payload, 'object')
  assert.notEqual(payload, null)

  return payload as Record<string, unknown>
}

test('web health payload stays stable for Docker probes', () => {
  const payload = buildWebHealthPayload(new Date('2026-04-02T00:00:00.000Z'))

  assert.equal(payload.service, '@ai-native-os/web')
  assert.equal(payload.status, 'ok')
  assert.equal(payload.timestamp, '2026-04-02T00:00:00.000Z')
})

test('web health route returns a no-store ok payload', async () => {
  const response = await GET()
  const payload = await readJsonRecord(response)

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(payload.service, '@ai-native-os/web')
  assert.equal(payload.status, 'ok')
})
