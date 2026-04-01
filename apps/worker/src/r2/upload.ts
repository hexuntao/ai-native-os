import type { cacheInvalidationQueueName, notificationQueueName } from '../contracts'

/**
 * 可归档的 worker 队列范围。
 */
export type WorkerArtifactScope = typeof cacheInvalidationQueueName | typeof notificationQueueName

/**
 * 生成适合放入 R2 key 的安全时间戳片段。
 */
function formatArtifactTimestamp(createdAt: Date): string {
  return createdAt.toISOString().replaceAll(':', '-')
}

/**
 * 生成队列回执的 R2 key。
 */
export function buildWorkerArtifactKey(
  scope: WorkerArtifactScope,
  messageId: string,
  createdAt: Date,
): string {
  const safeTimestamp = formatArtifactTimestamp(createdAt)
  const dateSegment = createdAt.toISOString().slice(0, 10)

  return `worker/${scope}/${dateSegment}/${safeTimestamp}-${messageId}.json`
}

/**
 * 将队列处理回执写入 R2，供部署与运行时 smoke trace 使用。
 */
export async function writeWorkerArtifact(
  bucket: R2Bucket,
  key: string,
  payload: unknown,
): Promise<string> {
  await bucket.put(key, JSON.stringify(payload, null, 2), {
    customMetadata: {
      producer: '@ai-native-os/worker',
      schema: 'queue-receipt-v1',
    },
    httpMetadata: {
      contentType: 'application/json; charset=utf-8',
    },
  })

  return key
}
