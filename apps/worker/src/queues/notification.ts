import {
  type NotificationQueueMessage,
  notificationQueueName,
  type WorkerQueueBatchProcessSummary,
  type WorkerResolvedBindings,
} from '../contracts'
import { buildWorkerArtifactKey, writeWorkerArtifact } from '../r2/upload'

const notificationRetryDelaySeconds = 30

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
    throw new Error(`Notification queue message requires a non-empty string field: ${key}`)
  }

  return value
}

/**
 * 读取并校验通知通道字段。
 */
function readNotificationChannel(
  record: Record<string, unknown>,
): NotificationQueueMessage['channel'] {
  const channel = readRequiredString(record, 'channel')

  if (channel !== 'email' && channel !== 'in-app' && channel !== 'webhook') {
    throw new Error(`Unsupported notification channel: ${channel}`)
  }

  return channel
}

/**
 * 读取通知消息中的 payload 对象。
 */
function readPayloadRecord(record: Record<string, unknown>): Record<string, unknown> {
  const payload = record.payload

  if (!isRecord(payload)) {
    throw new Error('Notification queue message requires an object payload')
  }

  return payload
}

/**
 * 解析并校验通知队列消息合同。
 */
export function parseNotificationQueueMessage(input: unknown): NotificationQueueMessage {
  if (!isRecord(input)) {
    throw new Error('Notification queue message must be an object')
  }

  return {
    channel: readNotificationChannel(input),
    correlationId: readRequiredString(input, 'correlationId'),
    payload: readPayloadRecord(input),
    requestedAt: readRequiredString(input, 'requestedAt'),
    target: readRequiredString(input, 'target'),
  }
}

/**
 * 处理单条通知队列消息，并把处理回执写入 R2。
 */
async function processNotificationQueueMessage(
  message: Message<unknown>,
  bindings: WorkerResolvedBindings,
  now: () => Date,
): Promise<'processed' | 'retried'> {
  try {
    const payload = parseNotificationQueueMessage(message.body)
    const processedAt = now()
    const artifactKey = buildWorkerArtifactKey(notificationQueueName, message.id, processedAt)

    await writeWorkerArtifact(bindings.R2_BUCKET, artifactKey, {
      attempts: message.attempts,
      artifactKey,
      kind: 'notification-receipt',
      messageId: message.id,
      processedAt: processedAt.toISOString(),
      queue: notificationQueueName,
      payload,
    })

    message.ack()

    return 'processed'
  } catch (error) {
    message.retry({ delaySeconds: notificationRetryDelaySeconds })
    console.error('notification queue message processing failed', {
      error: error instanceof Error ? error.message : 'unknown_error',
      messageId: message.id,
      queue: notificationQueueName,
    })

    return 'retried'
  }
}

/**
 * 批量处理通知队列，并返回可审计的处理摘要。
 */
export async function handleNotificationQueueBatch(
  batch: MessageBatch<unknown>,
  bindings: WorkerResolvedBindings,
  now: () => Date = () => new Date(),
): Promise<WorkerQueueBatchProcessSummary> {
  const results = await Promise.all(
    batch.messages.map((message) => processNotificationQueueMessage(message, bindings, now)),
  )
  const processedCount = results.filter((result) => result === 'processed').length

  return {
    processedCount,
    queue: notificationQueueName,
    retriedCount: results.length - processedCount,
  }
}
