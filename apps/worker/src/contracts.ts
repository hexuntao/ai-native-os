/**
 * 通知队列名称合同。
 */
export const notificationQueueName = 'notifications' as const

/**
 * 缓存失效队列名称合同。
 */
export const cacheInvalidationQueueName = 'cache-invalidation' as const

/**
 * Worker 健康检查烟雾路径。
 */
export const workerSmokeTestPath = '/health' as const

/**
 * Worker 当前支持的队列名称集合。
 */
export const workerQueueContract = [notificationQueueName, cacheInvalidationQueueName] as const

/**
 * Worker 当前要求的 binding 合同。
 *
 * 说明：
 * - `R2_BUCKET` 是当前运行时的必需 binding
 * - 两个队列生产者 binding 目前保持可选，以避免在 `P6-T3` 之前过早固化部署方式
 */
export const workerBindingContract = {
  optional: ['NOTIFICATION_QUEUE', 'CACHE_INVALIDATION_QUEUE'],
  required: ['R2_BUCKET'],
} as const

/**
 * 通知队列消息合同。
 */
export interface NotificationQueueMessage {
  channel: 'email' | 'in-app' | 'webhook'
  correlationId: string
  payload: Record<string, unknown>
  requestedAt: string
  target: string
}

/**
 * 缓存失效队列消息合同。
 */
export interface CacheInvalidationQueueMessage {
  correlationId: string
  reason: string
  requestedAt: string
  scope: 'asset' | 'route' | 'tag'
  target: string
}

/**
 * Worker 已知队列消息联合类型。
 */
export type WorkerQueueMessage = CacheInvalidationQueueMessage | NotificationQueueMessage

/**
 * Worker 在代码层消费的已解析 binding 合同。
 *
 * 说明：
 * - 这里不是最终的 Cloudflare `Env` 类型
 * - `P6-T3` 会在 `wrangler` 配置落地后，把平台生成类型与这里的应用合同接通
 */
export interface WorkerResolvedBindings {
  CACHE_INVALIDATION_QUEUE?: Queue<CacheInvalidationQueueMessage>
  NOTIFICATION_QUEUE?: Queue<NotificationQueueMessage>
  R2_BUCKET: R2Bucket
}

/**
 * Worker 绑定可用性快照。
 */
export interface WorkerBindingAvailability {
  cacheInvalidationQueueProducer: boolean
  notificationQueueProducer: boolean
  r2Bucket: boolean
}

/**
 * Worker 队列批次处理摘要。
 */
export interface WorkerQueueBatchProcessSummary {
  processedCount: number
  queue: (typeof workerQueueContract)[number]
  retriedCount: number
}

/**
 * Worker 健康检查响应合同。
 */
export interface WorkerHealthPayload {
  alignment: {
    deploymentConfigPending: true
    runtimeAligned: true
  }
  bindings: {
    availability: WorkerBindingAvailability
    optional: readonly string[]
    required: readonly string[]
  }
  name: '@ai-native-os/worker'
  queues: readonly string[]
  routes: readonly string[]
  smokeTestPath: typeof workerSmokeTestPath
  status: 'deployment-contract-ready'
}

/**
 * Worker 运行时摘要。
 */
export const workerRuntime: WorkerHealthPayload = {
  alignment: {
    deploymentConfigPending: true,
    runtimeAligned: true,
  },
  bindings: {
    availability: {
      cacheInvalidationQueueProducer: false,
      notificationQueueProducer: false,
      r2Bucket: true,
    },
    optional: workerBindingContract.optional,
    required: workerBindingContract.required,
  },
  name: '@ai-native-os/worker',
  queues: workerQueueContract,
  routes: [workerSmokeTestPath, '/bindings'],
  smokeTestPath: workerSmokeTestPath,
  status: 'deployment-contract-ready',
}
