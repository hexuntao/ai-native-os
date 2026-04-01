import assert from 'node:assert/strict'
import test from 'node:test'

import workerEntrypoint, {
  buildWorkerHealthPayload,
  handleWorkerFetch,
  handleWorkerQueue,
  resolveWorkerBindings,
  workerRuntime,
} from './index'

/**
 * R2 写入记录桩。
 */
interface BucketWriteRecord {
  key: string
  options: Record<string, unknown> | undefined
  value: string
}

/**
 * 队列消息桩状态。
 */
interface QueueMessageState {
  ackCount: number
  retryCount: number
}

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
 * 创建 R2 bucket 桩环境。
 */
function createWorkerEnvironment(): {
  environment: {
    CACHE_INVALIDATION_QUEUE: {
      send: () => Promise<void>
      sendBatch: () => Promise<void>
    }
    NOTIFICATION_QUEUE: {
      send: () => Promise<void>
      sendBatch: () => Promise<void>
    }
    R2_BUCKET: {
      get: () => Promise<null>
      head: () => Promise<null>
      put: (key: string, value: string, options?: Record<string, unknown>) => Promise<null>
    }
  }
  writes: BucketWriteRecord[]
} {
  const writes: BucketWriteRecord[] = []

  return {
    environment: {
      CACHE_INVALIDATION_QUEUE: {
        send: async () => undefined,
        sendBatch: async () => undefined,
      },
      NOTIFICATION_QUEUE: {
        send: async () => undefined,
        sendBatch: async () => undefined,
      },
      R2_BUCKET: {
        get: async () => null,
        head: async () => null,
        put: async (key: string, value: string, options?: Record<string, unknown>) => {
          writes.push({ key, options, value })

          return null
        },
      },
    },
    writes,
  }
}

/**
 * 创建可观测的队列消息桩。
 */
function createQueueMessage(
  body: unknown,
  id: string,
): {
  message: Message<unknown>
  state: QueueMessageState
} {
  const state: QueueMessageState = {
    ackCount: 0,
    retryCount: 0,
  }

  return {
    message: {
      ack(): void {
        state.ackCount += 1
      },
      attempts: 1,
      body,
      id,
      retry(): void {
        state.retryCount += 1
      },
      timestamp: new Date('2026-04-01T00:00:00.000Z'),
    },
    state,
  }
}

/**
 * 创建消息批次桩。
 */
function createMessageBatch(
  queue: string,
  messages: readonly Message<unknown>[],
): MessageBatch<unknown> {
  return {
    ackAll(): void {},
    messages,
    queue,
    retryAll(): void {},
  }
}

test('worker health payload reports runtime alignment and binding availability', () => {
  const { environment } = createWorkerEnvironment()
  const bindings = resolveWorkerBindings(environment)
  const payload = buildWorkerHealthPayload(bindings)

  assert.equal(payload.name, workerRuntime.name)
  assert.equal(payload.status, 'deployment-contract-ready')
  assert.equal(payload.smokeTestPath, '/health')
  assert.equal(payload.bindings.availability.r2Bucket, true)
  assert.equal(payload.bindings.availability.notificationQueueProducer, true)
  assert.equal(payload.bindings.availability.cacheInvalidationQueueProducer, true)
})

test('worker fetch exposes the health smoke path', async () => {
  const { environment } = createWorkerEnvironment()
  assert.equal(typeof workerEntrypoint.fetch, 'function')

  const response = handleWorkerFetch(new Request('https://worker.example.com/health'), environment)
  const payload = await readJsonRecord(response)

  assert.equal(response.status, 200)
  assert.equal(payload.status, 'deployment-contract-ready')
  assert.equal(payload.smokeTestPath, '/health')
})

test('notification queue batches archive receipts to R2 and acknowledge messages', async () => {
  const { environment, writes } = createWorkerEnvironment()
  const { message, state } = createQueueMessage(
    {
      channel: 'email',
      correlationId: 'notif-correlation',
      payload: { template: 'welcome' },
      requestedAt: '2026-04-01T08:00:00.000Z',
      target: 'user-1',
    },
    'notif-1',
  )

  const summary = await handleWorkerQueue(
    createMessageBatch('notifications', [message]),
    environment,
  )

  assert.equal(summary.queue, 'notifications')
  assert.equal(summary.processedCount, 1)
  assert.equal(summary.retriedCount, 0)
  assert.equal(state.ackCount, 1)
  assert.equal(state.retryCount, 0)
  assert.equal(writes.length, 1)
  assert.match(writes[0]?.key ?? '', /worker\/notifications\//)
})

test('cache invalidation queue batches archive receipts to R2 and acknowledge messages', async () => {
  const { environment, writes } = createWorkerEnvironment()
  const { message, state } = createQueueMessage(
    {
      correlationId: 'cache-correlation',
      reason: 'menu-republish',
      requestedAt: '2026-04-01T09:00:00.000Z',
      scope: 'tag',
      target: 'system:menus',
    },
    'cache-1',
  )

  const summary = await handleWorkerQueue(
    createMessageBatch('cache-invalidation', [message]),
    environment,
  )

  assert.equal(summary.queue, 'cache-invalidation')
  assert.equal(summary.processedCount, 1)
  assert.equal(summary.retriedCount, 0)
  assert.equal(state.ackCount, 1)
  assert.equal(state.retryCount, 0)
  assert.equal(writes.length, 1)
  assert.match(writes[0]?.key ?? '', /worker\/cache-invalidation\//)
})

test('invalid notification payloads are retried instead of acknowledged', async () => {
  const { environment, writes } = createWorkerEnvironment()
  const { message, state } = createQueueMessage(
    {
      channel: 'email',
      correlationId: 'notif-invalid',
      payload: { template: 'broken' },
      requestedAt: '2026-04-01T10:00:00.000Z',
    },
    'notif-invalid',
  )

  const summary = await handleWorkerQueue(
    createMessageBatch('notifications', [message]),
    environment,
  )

  assert.equal(summary.processedCount, 0)
  assert.equal(summary.retriedCount, 1)
  assert.equal(state.ackCount, 0)
  assert.equal(state.retryCount, 1)
  assert.equal(writes.length, 0)
})

test('unknown worker routes return a structured 404 payload', async () => {
  const { environment } = createWorkerEnvironment()
  const response = handleWorkerFetch(new Request('https://worker.example.com/unknown'), environment)
  const payload = await readJsonRecord(response)

  assert.equal(response.status, 404)
  assert.equal(payload.code, 'not_found')
})
