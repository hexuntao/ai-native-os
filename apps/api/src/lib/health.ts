import net from 'node:net'

import { db } from '@ai-native-os/db'
import {
  type DependencyHealthStatus,
  type DependencyProbe,
  healthResponseSchema,
  type TelemetryHealth,
  type TriggerRuntimeHealth,
} from '@ai-native-os/shared'
import { sql } from 'drizzle-orm'
import { z } from 'zod'

import { resolveAiRuntimeCapability } from '@/mastra/capabilities'
import { getTelemetryRuntimeState } from './telemetry'

export interface RedisProbeConfig {
  host: string
  password: string | null
  port: number
  timeoutMs: number
}

export interface ApiHealthSnapshot {
  checks: {
    api: 'ok'
    ai: ReturnType<typeof resolveAiRuntimeCapability>
    database: DependencyHealthStatus
    jobs: DependencyProbe
    redis: DependencyHealthStatus
    telemetry: TelemetryHealth
    trigger: TriggerRuntimeHealth
    worker: DependencyProbe
  }
  status: 'degraded' | 'ok'
  timestamp: string
}

export interface HttpServiceProbeConfig {
  timeoutMs: number
  url: string
}

const jobsRuntimeHealthPayloadSchema = z.object({
  runtime: z.object({
    scheduledTaskIds: z.array(z.string()),
    taskIds: z.array(z.string()),
  }),
  service: z.literal('@ai-native-os/jobs'),
  status: z.literal('ok'),
  timestamp: z.string().datetime(),
})

/**
 * Worker 健康检查最小合同，只校验当前 release/monitor 真正消费的关键字段。
 */
const workerHealthPayloadSchema = z.object({
  bindings: z.object({
    availability: z.object({
      cacheInvalidationQueueProducer: z.boolean(),
      notificationQueueProducer: z.boolean(),
      r2Bucket: z.boolean(),
    }),
  }),
  name: z.literal('@ai-native-os/worker'),
  queues: z.array(z.string()),
  routes: z.array(z.string()),
  smokeTestPath: z.literal('/health'),
  status: z.literal('deployment-contract-ready'),
})

/**
 * 解析正整数超时配置，避免健康探针接受非法值。
 */
function parseHealthTimeout(rawValue: string | undefined, fallbackValue: number): number {
  const parsedTimeout = Number.parseInt(rawValue ?? '', 10)

  if (!Number.isFinite(parsedTimeout) || parsedTimeout <= 0) {
    return fallbackValue
  }

  return parsedTimeout
}

/**
 * 解析可选的 HTTP 健康探针配置。
 */
function resolveHttpServiceProbeConfig(
  rawUrl: string | undefined,
  timeoutMs: number,
): HttpServiceProbeConfig | null {
  if (!rawUrl?.trim()) {
    return null
  }

  const probeUrl = new URL(rawUrl.trim())

  return {
    timeoutMs,
    url: probeUrl.toString(),
  }
}

/**
 * 解析 Trigger.dev 运行态配置，供 `/health` 与监控摘要复用。
 */
export function resolveTriggerRuntimeHealth(
  environment: NodeJS.ProcessEnv = process.env,
): TriggerRuntimeHealth {
  const apiUrl = environment.TRIGGER_API_URL?.trim() || null
  const projectRef = environment.TRIGGER_PROJECT_REF?.trim() || null
  const secretKeyConfigured = Boolean(environment.TRIGGER_SECRET_KEY?.trim())
  const projectRefConfigured = Boolean(projectRef)

  return {
    apiUrl,
    projectRef,
    projectRefConfigured,
    secretKeyConfigured,
    status: projectRefConfigured && secretKeyConfigured ? 'ok' : 'unknown',
  }
}

/**
 * 执行统一的 HTTP 依赖健康探针。
 */
async function probeHttpDependency(
  config: HttpServiceProbeConfig | null,
  label: string,
  validator: (payload: unknown) => string,
): Promise<DependencyProbe> {
  if (!config) {
    return {
      detail: `${label} health probe is not configured`,
      status: 'unknown',
    }
  }

  try {
    const response = await fetch(config.url, {
      headers: {
        accept: 'application/json',
      },
      method: 'GET',
      signal: AbortSignal.timeout(config.timeoutMs),
    })

    if (!response.ok) {
      return {
        detail: `${label} health probe returned HTTP ${response.status}`,
        status: 'error',
      }
    }

    const payload = (await response.json()) as unknown

    return {
      detail: validator(payload),
      status: 'ok',
    }
  } catch (error) {
    return {
      detail: `${label} health probe failed: ${error instanceof Error ? error.message : String(error)}`,
      status: 'error',
    }
  }
}

/**
 * 校验 jobs 健康检查响应，并提取最小可读摘要。
 */
function validateJobsHealthPayload(payload: unknown): string {
  const jobsPayload = jobsRuntimeHealthPayloadSchema.parse(payload)

  return `service=@ai-native-os/jobs, tasks=${jobsPayload.runtime.taskIds.length}, scheduled=${jobsPayload.runtime.scheduledTaskIds.length}`
}

/**
 * 校验 worker 健康检查响应，并提取最小可读摘要。
 */
function validateWorkerHealthPayload(payload: unknown): string {
  const workerPayload = workerHealthPayloadSchema.parse(payload)

  return `service=${workerPayload.name}, queues=${workerPayload.queues.length}, r2=${workerPayload.bindings.availability.r2Bucket}`
}

function encodeRedisCommand(parts: string[]): string {
  return `*${parts.length}\r\n${parts
    .map((part) => `$${Buffer.byteLength(part)}\r\n${part}\r\n`)
    .join('')}`
}

function waitForSocketConnect(socket: net.Socket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.once('connect', resolve)
    socket.once('error', reject)
  })
}

function readRedisReply(socket: net.Socket, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const cleanup = (): void => {
      socket.off('data', onData)
      socket.off('error', onError)
      socket.off('timeout', onTimeout)
    }
    const onData = (chunk: Buffer): void => {
      cleanup()
      resolve(chunk.toString('utf8'))
    }
    const onError = (error: Error): void => {
      cleanup()
      reject(error)
    }
    const onTimeout = (): void => {
      cleanup()
      reject(new Error('Redis health probe timed out'))
    }

    socket.setTimeout(timeoutMs)
    socket.once('data', onData)
    socket.once('error', onError)
    socket.once('timeout', onTimeout)
  })
}

async function sendRedisCommand(
  socket: net.Socket,
  parts: string[],
  timeoutMs: number,
): Promise<string> {
  socket.write(encodeRedisCommand(parts))

  return readRedisReply(socket, timeoutMs)
}

async function pingRedis(config: RedisProbeConfig): Promise<void> {
  const socket = net.createConnection({
    host: config.host,
    port: config.port,
  })

  try {
    await waitForSocketConnect(socket)

    if (config.password) {
      const authReply = await sendRedisCommand(socket, ['AUTH', config.password], config.timeoutMs)

      if (!authReply.startsWith('+OK')) {
        throw new Error(`Unexpected Redis AUTH reply: ${authReply.trim()}`)
      }
    }

    const pingReply = await sendRedisCommand(socket, ['PING'], config.timeoutMs)

    if (!pingReply.startsWith('+PONG')) {
      throw new Error(`Unexpected Redis PING reply: ${pingReply.trim()}`)
    }
  } finally {
    socket.end()
    socket.destroy()
  }
}

/**
 * 解析 Redis 健康检查配置。
 *
 * 支持两种入口：
 * - `REDIS_URL`
 * - `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD`
 */
export function resolveRedisProbeConfig(environment: NodeJS.ProcessEnv): RedisProbeConfig | null {
  const timeoutMs = Number.parseInt(environment.REDIS_HEALTH_TIMEOUT_MS ?? '1500', 10)
  const normalizedTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 1500

  if (environment.REDIS_URL) {
    const redisUrl = new URL(environment.REDIS_URL)

    return {
      host: redisUrl.hostname,
      password: redisUrl.password || null,
      port: Number.parseInt(redisUrl.port || '6379', 10),
      timeoutMs: normalizedTimeoutMs,
    }
  }

  if (
    environment.REDIS_HOST ||
    environment.REDIS_PORT ||
    Object.hasOwn(environment, 'REDIS_PASSWORD')
  ) {
    const port = Number.parseInt(environment.REDIS_PORT ?? '6379', 10)

    return {
      host: environment.REDIS_HOST ?? '127.0.0.1',
      password: environment.REDIS_PASSWORD ?? null,
      port: Number.isFinite(port) ? port : 6379,
      timeoutMs: normalizedTimeoutMs,
    }
  }

  return null
}

/**
 * 解析跨进程 HTTP 健康探针的超时时间。
 */
export function resolveDependencyProbeTimeoutMs(
  environment: NodeJS.ProcessEnv = process.env,
): number {
  return parseHealthTimeout(environment.DEPENDENCY_HEALTH_TIMEOUT_MS, 2500)
}

/**
 * 解析 jobs 健康探针配置。
 */
export function resolveJobsProbeConfig(
  environment: NodeJS.ProcessEnv = process.env,
): HttpServiceProbeConfig | null {
  return resolveHttpServiceProbeConfig(
    environment.JOBS_HEALTH_URL,
    resolveDependencyProbeTimeoutMs(environment),
  )
}

/**
 * 解析 worker 健康探针配置。
 */
export function resolveWorkerProbeConfig(
  environment: NodeJS.ProcessEnv = process.env,
): HttpServiceProbeConfig | null {
  return resolveHttpServiceProbeConfig(
    environment.WORKER_HEALTH_URL,
    resolveDependencyProbeTimeoutMs(environment),
  )
}

/**
 * 执行数据库健康检查。
 */
export async function checkDatabaseHealth(): Promise<DependencyHealthStatus> {
  try {
    await db.execute(sql`select 1`)

    return 'ok'
  } catch {
    return 'error'
  }
}

/**
 * 执行 Redis 健康检查。
 *
 * 未配置 Redis 连接时返回 `unknown`，避免把本地未接线场景误判为故障。
 */
export async function checkRedisHealth(
  config: RedisProbeConfig | null = resolveRedisProbeConfig(process.env),
): Promise<DependencyHealthStatus> {
  if (!config) {
    return 'unknown'
  }

  try {
    await pingRedis(config)

    return 'ok'
  } catch {
    return 'error'
  }
}

/**
 * 执行 jobs 健康探针。
 */
export async function checkJobsHealth(
  config: HttpServiceProbeConfig | null = resolveJobsProbeConfig(process.env),
): Promise<DependencyProbe> {
  return probeHttpDependency(config, 'jobs', validateJobsHealthPayload)
}

/**
 * 执行 worker 健康探针。
 */
export async function checkWorkerHealth(
  config: HttpServiceProbeConfig | null = resolveWorkerProbeConfig(process.env),
): Promise<DependencyProbe> {
  return probeHttpDependency(config, 'worker', validateWorkerHealthPayload)
}

function buildTelemetryHealth(): TelemetryHealth {
  const telemetryState = getTelemetryRuntimeState()

  return {
    openTelemetry: telemetryState.openTelemetry,
    sentry: telemetryState.sentry,
  }
}

/**
 * 生成统一的健康检查快照，供 `/health` 与监控摘要复用。
 */
export async function getApiHealthSnapshot(): Promise<ApiHealthSnapshot> {
  const [database, jobs, redis, worker] = await Promise.all([
    checkDatabaseHealth(),
    checkJobsHealth(),
    checkRedisHealth(),
    checkWorkerHealth(),
  ])
  const ai = resolveAiRuntimeCapability()
  const telemetry = buildTelemetryHealth()
  const trigger = resolveTriggerRuntimeHealth()
  const hasError =
    database === 'error' ||
    ai.status === 'degraded' ||
    jobs.status === 'error' ||
    redis === 'error' ||
    telemetry.openTelemetry === 'error' ||
    telemetry.sentry === 'error' ||
    worker.status === 'error'

  return healthResponseSchema.parse({
    checks: {
      api: 'ok',
      ai,
      database,
      jobs,
      redis,
      telemetry,
      trigger,
      worker,
    },
    status: hasError ? 'degraded' : 'ok',
    timestamp: new Date().toISOString(),
  }) as ApiHealthSnapshot
}
