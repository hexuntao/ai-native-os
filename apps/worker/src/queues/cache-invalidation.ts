import {
  type CacheInvalidationQueueMessage,
  cacheInvalidationQueueName,
  type WorkerQueueBatchProcessSummary,
  type WorkerResolvedBindings,
} from '../contracts'
import { buildWorkerArtifactKey, writeWorkerArtifact } from '../r2/upload'

const cacheInvalidationRetryDelaySeconds = 30

/**
 * 判断未知输入是否可视为普通对象。
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * 读取消息中的必填字符串字段。
 */
function readRequiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key]

  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Cache invalidation queue message requires a non-empty string field: ${key}`)
  }

  return value
}

/**
 * 读取并校验缓存失效范围字段。
 */
function readInvalidationScope(
  record: Record<string, unknown>,
): CacheInvalidationQueueMessage['scope'] {
  const scope = readRequiredString(record, 'scope')

  if (scope !== 'asset' && scope !== 'route' && scope !== 'tag') {
    throw new Error(`Unsupported cache invalidation scope: ${scope}`)
  }

  return scope
}

/**
 * 解析并校验缓存失效队列消息合同。
 */
export function parseCacheInvalidationQueueMessage(input: unknown): CacheInvalidationQueueMessage {
  if (!isRecord(input)) {
    throw new Error('Cache invalidation queue message must be an object')
  }

  return {
    correlationId: readRequiredString(input, 'correlationId'),
    reason: readRequiredString(input, 'reason'),
    requestedAt: readRequiredString(input, 'requestedAt'),
    scope: readInvalidationScope(input),
    target: readRequiredString(input, 'target'),
  }
}

/**
 * 处理单条缓存失效消息，并把处理回执写入 R2。
 */
async function processCacheInvalidationQueueMessage(
  message: Message<unknown>,
  bindings: WorkerResolvedBindings,
  now: () => Date,
): Promise<'processed' | 'retried'> {
  try {
    const payload = parseCacheInvalidationQueueMessage(message.body)
    const processedAt = now()
    const artifactKey = buildWorkerArtifactKey(cacheInvalidationQueueName, message.id, processedAt)

    await writeWorkerArtifact(bindings.R2_BUCKET, artifactKey, {
      attempts: message.attempts,
      artifactKey,
      kind: 'cache-invalidation-receipt',
      messageId: message.id,
      processedAt: processedAt.toISOString(),
      queue: cacheInvalidationQueueName,
      payload,
    })

    message.ack()

    return 'processed'
  } catch (error) {
    message.retry({ delaySeconds: cacheInvalidationRetryDelaySeconds })
    console.error('cache invalidation queue message processing failed', {
      error: error instanceof Error ? error.message : 'unknown_error',
      messageId: message.id,
      queue: cacheInvalidationQueueName,
    })

    return 'retried'
  }
}

/**
 * 批量处理缓存失效队列，并返回可审计的处理摘要。
 */
export async function handleCacheInvalidationQueueBatch(
  batch: MessageBatch<unknown>,
  bindings: WorkerResolvedBindings,
  now: () => Date = () => new Date(),
): Promise<WorkerQueueBatchProcessSummary> {
  const results = await Promise.all(
    batch.messages.map((message) => processCacheInvalidationQueueMessage(message, bindings, now)),
  )
  const processedCount = results.filter((result) => result === 'processed').length

  return {
    processedCount,
    queue: cacheInvalidationQueueName,
    retriedCount: results.length - processedCount,
  }
}
