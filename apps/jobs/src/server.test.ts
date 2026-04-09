import assert from 'node:assert/strict'
import type { Server } from 'node:http'
import test from 'node:test'

import { jobsRuntime } from './runtime'
import { buildJobsHealthPayload, createJobsServer, resolveJobsServerEnvironment } from './server'

/**
 * 读取 JSON 响应体并收窄为对象记录。
 */
async function readJsonRecord(response: Response): Promise<Record<string, unknown>> {
  const payload = JSON.parse(await response.text()) as unknown

  assert.equal(typeof payload, 'object')
  assert.notEqual(payload, null)

  return payload as Record<string, unknown>
}

/**
 * 关闭测试 server，避免测试进程残留监听端口。
 */
async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

test('jobs self-hosted environment falls back to container-safe defaults', () => {
  const environment = resolveJobsServerEnvironment({})

  assert.equal(environment.host, '0.0.0.0')
  assert.equal(environment.port, 3040)
})

test('jobs self-hosted environment prefers JOBS_PORT over shared PORT', () => {
  const environment = resolveJobsServerEnvironment({
    JOBS_PORT: '3040',
    PORT: '3001',
  })

  assert.equal(environment.port, 3040)
})

test('jobs health payload exposes runtime summary for Docker probes', () => {
  const payload = buildJobsHealthPayload(new Date('2026-04-02T00:00:00.000Z'))

  assert.equal(payload.service, jobsRuntime.name)
  assert.equal(payload.status, 'ok')
  assert.equal(payload.timestamp, '2026-04-02T00:00:00.000Z')
  assert.deepEqual(payload.runtime.taskIds, jobsRuntime.taskIds)
})

test('jobs self-hosted server exposes health and 404 responses', async () => {
  const server = createJobsServer()

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve())
  })

  try {
    const address = server.address()

    if (address === null || typeof address === 'string') {
      throw new Error('Expected jobs test server to expose a TCP address.')
    }

    const healthResponse = await fetch(`http://127.0.0.1:${address.port}/health`)
    const healthPayload = await readJsonRecord(healthResponse)
    const notFoundResponse = await fetch(`http://127.0.0.1:${address.port}/unknown`)
    const notFoundPayload = await readJsonRecord(notFoundResponse)

    assert.equal(healthResponse.status, 200)
    assert.equal(healthPayload.status, 'ok')
    assert.equal(healthPayload.service, jobsRuntime.name)

    assert.equal(notFoundResponse.status, 404)
    assert.equal(notFoundPayload.code, 'not_found')
  } finally {
    await closeServer(server)
  }
})
