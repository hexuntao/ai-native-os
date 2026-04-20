import assert from 'node:assert/strict'
import net from 'node:net'
import test from 'node:test'

import {
  checkJobsHealth,
  checkRedisHealth,
  checkWorkerHealth,
  resolveDependencyProbeTimeoutMs,
  resolveJobsProbeConfig,
  resolveRedisProbeConfig,
  resolveTriggerRuntimeHealth,
  resolveWorkerProbeConfig,
} from './health'

test('resolveRedisProbeConfig parses REDIS_URL into a probe configuration', () => {
  const probeConfig = resolveRedisProbeConfig({
    REDIS_HEALTH_TIMEOUT_MS: '900',
    REDIS_URL: 'redis://:redis-secret@127.0.0.1:6380',
  })

  assert.deepEqual(probeConfig, {
    host: '127.0.0.1',
    password: 'redis-secret',
    port: 6380,
    timeoutMs: 900,
  })
})

test('checkRedisHealth reports ok for a reachable AUTH + PING endpoint', async () => {
  const server = net.createServer((socket) => {
    let commandIndex = 0

    socket.on('data', () => {
      if (commandIndex === 0) {
        commandIndex += 1
        socket.write('+OK\r\n')

        return
      }

      socket.write('+PONG\r\n')
      socket.end()
    })
  })

  await new Promise<void>((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => resolve())
    server.once('error', reject)
  })

  const address = server.address()

  assert.ok(address && typeof address === 'object')

  try {
    const status = await checkRedisHealth({
      host: '127.0.0.1',
      password: 'redis',
      port: address.port,
      timeoutMs: 500,
    })

    assert.equal(status, 'ok')
  } finally {
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
})

test('resolveDependencyProbeTimeoutMs falls back to default for invalid input', () => {
  assert.equal(resolveDependencyProbeTimeoutMs({ DEPENDENCY_HEALTH_TIMEOUT_MS: '0' }), 2500)
  assert.equal(resolveDependencyProbeTimeoutMs({ DEPENDENCY_HEALTH_TIMEOUT_MS: '900' }), 900)
})

test('resolveJobsProbeConfig and resolveWorkerProbeConfig parse optional URLs', () => {
  assert.equal(resolveJobsProbeConfig({}), null)
  assert.equal(resolveWorkerProbeConfig({}), null)
  assert.deepEqual(
    resolveJobsProbeConfig({
      DEPENDENCY_HEALTH_TIMEOUT_MS: '1200',
      JOBS_HEALTH_URL: 'https://jobs.example.com/health',
    }),
    {
      timeoutMs: 1200,
      url: 'https://jobs.example.com/health',
    },
  )
  assert.deepEqual(
    resolveWorkerProbeConfig({
      DEPENDENCY_HEALTH_TIMEOUT_MS: '1200',
      WORKER_HEALTH_URL: 'https://worker.example.com/health',
    }),
    {
      timeoutMs: 1200,
      url: 'https://worker.example.com/health',
    },
  )
})

test('resolveTriggerRuntimeHealth reports ok when trigger project ref and secret exist', () => {
  assert.deepEqual(
    resolveTriggerRuntimeHealth({
      TRIGGER_API_URL: 'https://api.trigger.dev',
      TRIGGER_PROJECT_REF: 'proj_test_123',
      TRIGGER_SECRET_KEY: 'tr_dev_secret',
    }),
    {
      apiUrl: 'https://api.trigger.dev',
      projectRef: 'proj_test_123',
      projectRefConfigured: true,
      secretKeyConfigured: true,
      status: 'ok',
    },
  )
})

test('checkJobsHealth and checkWorkerHealth return unknown when probe is not configured', async () => {
  const [jobsProbe, workerProbe] = await Promise.all([
    checkJobsHealth(null),
    checkWorkerHealth(null),
  ])

  assert.equal(jobsProbe.status, 'unknown')
  assert.match(jobsProbe.detail, /not configured/)
  assert.equal(workerProbe.status, 'unknown')
  assert.match(workerProbe.detail, /not configured/)
})
