import assert from 'node:assert/strict'
import net from 'node:net'
import test from 'node:test'

import { checkRedisHealth, resolveRedisProbeConfig } from './health'

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
