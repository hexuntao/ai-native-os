import { ErrorCodes } from '@ai-native-os/shared'
import type { Context, MiddlewareHandler } from 'hono'

const defaultExemptPathPrefixes = ['/health'] as const
const authRoutePrefix = '/api/auth'

interface ApiRateLimitBucketState {
  count: number
  resetAt: number
}

interface ApiRateLimitProfile {
  bucketName: 'auth' | 'general'
  maxRequests: number
  windowMs: number
}

interface ApiRateLimitDecision {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: number
  retryAfterSeconds: number
}

export interface ApiRateLimitEnvironment {
  authMaxRequests: number
  authWindowMs: number
  enabled: boolean
  exemptPathPrefixes: readonly string[]
  generalMaxRequests: number
  generalWindowMs: number
}

export interface ApiRateLimitDependencies {
  now: () => number
  store: Map<string, ApiRateLimitBucketState>
}

const defaultApiRateLimitDependencies: ApiRateLimitDependencies = {
  now: () => Date.now(),
  store: new Map<string, ApiRateLimitBucketState>(),
}

/**
 * 解析 API 限流运行时配置。
 *
 * 说明：
 * - 生产环境默认开启，避免本地开发与测试被全局限流打断
 * - 当前实现不引入新的环境变量，保持纠偏任务范围最小
 */
export function resolveApiRateLimitEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): ApiRateLimitEnvironment {
  return {
    authMaxRequests: 20,
    authWindowMs: 60_000,
    enabled: environment.NODE_ENV === 'production',
    exemptPathPrefixes: defaultExemptPathPrefixes,
    generalMaxRequests: 120,
    generalWindowMs: 60_000,
  }
}

/**
 * 判断当前路径是否应跳过限流。
 *
 * 说明：
 * - 只读健康探针不能因为限流影响部署平台的 readiness / liveness 判断
 * - `OPTIONS` 预检请求也不计入额度，避免与 CORS 互相干扰
 */
function shouldSkipApiRateLimit(context: Context, environment: ApiRateLimitEnvironment): boolean {
  if (context.req.method === 'OPTIONS') {
    return true
  }

  return environment.exemptPathPrefixes.some((prefix) => {
    return context.req.path === prefix || context.req.path.startsWith(`${prefix}/`)
  })
}

/**
 * 从代理头与直连信息中提取客户端标识。
 *
 * 说明：
 * - 优先读取 Cloudflare / 反向代理常见头
 * - 若没有真实地址，则退化为 `unknown-client`
 */
function resolveClientIdentifier(context: Context): string {
  const forwardedClientIp = context.req.header('cf-connecting-ip')
  const realClientIp = context.req.header('x-real-ip')
  const forwardedChain = context.req.header('x-forwarded-for')
  const firstForwardedIp = forwardedChain?.split(',')[0]?.trim()

  return forwardedClientIp || realClientIp || firstForwardedIp || 'unknown-client'
}

/**
 * 根据请求路径选择限流策略。
 *
 * 说明：
 * - 认证入口使用更严格的阈值，降低撞库和暴力尝试风险
 * - 其余 API 走通用配额，作为基础安全阈值
 */
function resolveApiRateLimitProfile(
  requestPath: string,
  environment: ApiRateLimitEnvironment,
): ApiRateLimitProfile {
  if (requestPath === authRoutePrefix || requestPath.startsWith(`${authRoutePrefix}/`)) {
    return {
      bucketName: 'auth',
      maxRequests: environment.authMaxRequests,
      windowMs: environment.authWindowMs,
    }
  }

  return {
    bucketName: 'general',
    maxRequests: environment.generalMaxRequests,
    windowMs: environment.generalWindowMs,
  }
}

/**
 * 清理已经过期的 bucket，避免进程常驻时内存无限增长。
 */
function cleanupExpiredRateLimitBuckets(
  store: Map<string, ApiRateLimitBucketState>,
  nowMs: number,
): void {
  if (store.size < 1_000) {
    return
  }

  for (const [key, bucket] of store.entries()) {
    if (bucket.resetAt <= nowMs) {
      store.delete(key)
    }
  }
}

/**
 * 生成当前请求的 bucket 键。
 *
 * 说明：
 * - 同一客户端在不同限流策略下使用不同 bucket
 * - 避免认证入口和普通业务请求互相污染额度
 */
function buildRateLimitBucketKey(clientIdentifier: string, profile: ApiRateLimitProfile): string {
  return `${profile.bucketName}:${clientIdentifier}`
}

/**
 * 消耗一次请求额度，并返回本次决策。
 */
function consumeApiRateLimitToken(
  bucketKey: string,
  profile: ApiRateLimitProfile,
  dependencies: ApiRateLimitDependencies,
): ApiRateLimitDecision {
  const nowMs = dependencies.now()
  cleanupExpiredRateLimitBuckets(dependencies.store, nowMs)

  const existingBucket = dependencies.store.get(bucketKey)
  const activeBucket =
    existingBucket && existingBucket.resetAt > nowMs
      ? existingBucket
      : {
          count: 0,
          resetAt: nowMs + profile.windowMs,
        }

  activeBucket.count += 1
  dependencies.store.set(bucketKey, activeBucket)

  const remaining = Math.max(profile.maxRequests - activeBucket.count, 0)
  const retryAfterSeconds = Math.max(Math.ceil((activeBucket.resetAt - nowMs) / 1000), 1)

  return {
    allowed: activeBucket.count <= profile.maxRequests,
    limit: profile.maxRequests,
    remaining,
    resetAt: activeBucket.resetAt,
    retryAfterSeconds,
  }
}

/**
 * 写入限流响应头，便于客户端和上游网关理解剩余额度。
 */
function applyRateLimitHeaders(context: Context, decision: ApiRateLimitDecision): void {
  context.header('X-RateLimit-Limit', String(decision.limit))
  context.header('X-RateLimit-Remaining', String(decision.remaining))
  context.header('X-RateLimit-Reset', String(Math.floor(decision.resetAt / 1000)))
}

/**
 * 构造统一的 `429` 响应体。
 */
function createRateLimitExceededResponse(
  context: Context,
  decision: ApiRateLimitDecision,
): Response {
  applyRateLimitHeaders(context, decision)
  context.header('Retry-After', String(decision.retryAfterSeconds))

  return context.json(
    {
      code: ErrorCodes.RATE_LIMITED.code,
      message: ErrorCodes.RATE_LIMITED.message,
    },
    429,
  )
}

/**
 * 创建 API 限流中间件。
 *
 * 说明：
 * - 当前实现是进程内 best-effort 限流，优先补齐架构与发布安全基线
 * - 分布式或共享存储型限流可在后续专门任务中再演进
 */
export function createApiRateLimitMiddleware(
  environment: ApiRateLimitEnvironment = resolveApiRateLimitEnvironment(),
  dependencies: ApiRateLimitDependencies = defaultApiRateLimitDependencies,
): MiddlewareHandler {
  return async function apiRateLimitMiddleware(context, next): Promise<Response | undefined> {
    if (!environment.enabled || shouldSkipApiRateLimit(context, environment)) {
      await next()
      return
    }

    const profile = resolveApiRateLimitProfile(context.req.path, environment)
    const clientIdentifier = resolveClientIdentifier(context)
    const decision = consumeApiRateLimitToken(
      buildRateLimitBucketKey(clientIdentifier, profile),
      profile,
      dependencies,
    )

    if (!decision.allowed) {
      return createRateLimitExceededResponse(context, decision)
    }

    applyRateLimitHeaders(context, decision)
    await next()
  }
}
