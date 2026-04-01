import {
  type CacheInvalidationQueueMessage,
  cacheInvalidationQueueName,
  type NotificationQueueMessage,
  notificationQueueName,
  type WorkerBindingAvailability,
  type WorkerHealthPayload,
  type WorkerQueueBatchProcessSummary,
  type WorkerQueueMessage,
  type WorkerResolvedBindings,
  workerBindingContract,
  workerRuntime,
  workerSmokeTestPath,
} from './contracts'
import { handleCacheInvalidationQueueBatch } from './queues/cache-invalidation'
import { handleNotificationQueueBatch } from './queues/notification'

/**
 * 将未知输入收窄为普通对象，便于读取 binding。
 */
function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Worker environment must be an object record')
  }

  return value as Record<string, unknown>
}

/**
 * 判断未知输入是否具备 Queue binding 的最小函数面。
 */
function isQueueBinding<Body>(value: unknown): value is Queue<Body> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'send') === 'function' &&
    typeof Reflect.get(value, 'sendBatch') === 'function'
  )
}

/**
 * 判断未知输入是否具备 R2 bucket 的最小函数面。
 */
function isR2BucketBinding(value: unknown): value is R2Bucket {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'get') === 'function' &&
    typeof Reflect.get(value, 'head') === 'function' &&
    typeof Reflect.get(value, 'put') === 'function'
  )
}

/**
 * 解析 worker 当前代码真正依赖的 binding 合同。
 */
export function resolveWorkerBindings(environment: unknown): WorkerResolvedBindings {
  const record = asRecord(environment)
  const r2Bucket = record.R2_BUCKET

  if (!isR2BucketBinding(r2Bucket)) {
    throw new Error('Worker binding contract requires a valid R2_BUCKET binding')
  }

  const notificationQueue = record.NOTIFICATION_QUEUE
  const cacheInvalidationQueue = record.CACHE_INVALIDATION_QUEUE
  const resolvedBindings: WorkerResolvedBindings = {
    R2_BUCKET: r2Bucket,
  }

  if (isQueueBinding<NotificationQueueMessage>(notificationQueue)) {
    resolvedBindings.NOTIFICATION_QUEUE = notificationQueue
  }

  if (isQueueBinding<CacheInvalidationQueueMessage>(cacheInvalidationQueue)) {
    resolvedBindings.CACHE_INVALIDATION_QUEUE = cacheInvalidationQueue
  }

  return resolvedBindings
}

/**
 * 生成 worker 当前 binding 可用性快照。
 */
export function resolveWorkerBindingAvailability(
  bindings: WorkerResolvedBindings,
): WorkerBindingAvailability {
  return {
    cacheInvalidationQueueProducer: Boolean(bindings.CACHE_INVALIDATION_QUEUE),
    notificationQueueProducer: Boolean(bindings.NOTIFICATION_QUEUE),
    r2Bucket: true,
  }
}

/**
 * 生成 worker 健康检查返回体。
 */
export function buildWorkerHealthPayload(bindings: WorkerResolvedBindings): WorkerHealthPayload {
  return {
    ...workerRuntime,
    bindings: {
      ...workerRuntime.bindings,
      availability: resolveWorkerBindingAvailability(bindings),
    },
  }
}

/**
 * 生成统一的 JSON 响应。
 */
function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return Response.json(body, init)
}

/**
 * 根据请求生成 worker 的只读 smoke 响应。
 */
export function handleWorkerFetch(request: Request, environment: unknown): Response {
  try {
    const bindings = resolveWorkerBindings(environment)
    const pathname = new URL(request.url).pathname

    if (pathname === workerSmokeTestPath) {
      if (request.method !== 'GET') {
        return jsonResponse(
          {
            code: 'method_not_allowed',
            message: 'Worker health route only supports GET',
          },
          { status: 405 },
        )
      }

      return jsonResponse(buildWorkerHealthPayload(bindings))
    }

    if (pathname === '/bindings') {
      if (request.method !== 'GET') {
        return jsonResponse(
          {
            code: 'method_not_allowed',
            message: 'Worker binding route only supports GET',
          },
          { status: 405 },
        )
      }

      return jsonResponse({
        availability: resolveWorkerBindingAvailability(bindings),
        optional: workerBindingContract.optional,
        required: workerBindingContract.required,
      })
    }

    return jsonResponse(
      {
        code: 'not_found',
        message: 'Worker runtime route not found',
        routes: workerRuntime.routes,
      },
      { status: 404 },
    )
  } catch (error) {
    return jsonResponse(
      {
        code: 'binding_contract_invalid',
        message: error instanceof Error ? error.message : 'Unknown worker binding error',
      },
      { status: 500 },
    )
  }
}

/**
 * 根据队列名称分发 worker 队列处理逻辑。
 */
export async function handleWorkerQueue(
  batch: MessageBatch<unknown>,
  environment: unknown,
): Promise<WorkerQueueBatchProcessSummary> {
  const bindings = resolveWorkerBindings(environment)

  if (batch.queue === notificationQueueName) {
    return handleNotificationQueueBatch(batch, bindings)
  }

  if (batch.queue === cacheInvalidationQueueName) {
    return handleCacheInvalidationQueueBatch(batch, bindings)
  }

  throw new Error(`Unsupported worker queue: ${batch.queue}`)
}

/**
 * Worker 默认导出入口。
 */
const workerEntrypoint: ExportedHandler<unknown, WorkerQueueMessage> = {
  async fetch(request, environment, _ctx) {
    return handleWorkerFetch(request, environment)
  },
  async queue(batch, environment, _ctx) {
    await handleWorkerQueue(batch, environment)
  },
}

export default workerEntrypoint

export { workerRuntime }
