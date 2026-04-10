import net from 'node:net'

import { db } from '@ai-native-os/db'
import {
  type DependencyHealthStatus,
  healthResponseSchema,
  type TelemetryHealth,
} from '@ai-native-os/shared'
import { sql } from 'drizzle-orm'

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
    redis: DependencyHealthStatus
    telemetry: TelemetryHealth
  }
  status: 'degraded' | 'ok'
  timestamp: string
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
  const [database, redis] = await Promise.all([checkDatabaseHealth(), checkRedisHealth()])
  const ai = resolveAiRuntimeCapability()
  const telemetry = buildTelemetryHealth()
  const hasError =
    database === 'error' ||
    ai.status === 'degraded' ||
    redis === 'error' ||
    telemetry.openTelemetry === 'error' ||
    telemetry.sentry === 'error'

  return healthResponseSchema.parse({
    checks: {
      api: 'ok',
      ai,
      database,
      redis,
      telemetry,
    },
    status: hasError ? 'degraded' : 'ok',
    timestamp: new Date().toISOString(),
  }) as ApiHealthSnapshot
}
