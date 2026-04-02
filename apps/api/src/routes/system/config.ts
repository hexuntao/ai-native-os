import {
  type ConfigListResponse,
  configListResponseSchema,
  type ListConfigsInput,
  listConfigsInputSchema,
} from '@ai-native-os/shared'

import { resolveRedisProbeConfig } from '@/lib/health'
import { resolveApiTelemetryConfig } from '@/lib/telemetry'
import { resolveMastraEnvironment } from '@/mastra/env'
import { resolveApiRateLimitEnvironment } from '@/middleware/rate-limit'
import { requireAnyPermission } from '@/orpc/procedures'
import { createPagination, paginateArray } from '@/routes/lib/pagination'

type ConfigListItem = ConfigListResponse['data'][number]

/**
 * 构建可安全暴露给后台管理面的运行时配置摘要。
 *
 * 关键约束：
 * - 只暴露非敏感、可审计的配置状态
 * - 不返回任何 secret 原文，避免把配置面做成凭据泄漏通道
 */
function buildConfigCatalog(): ConfigListItem[] {
  const telemetryConfig = resolveApiTelemetryConfig(process.env)
  const rateLimitEnvironment = resolveApiRateLimitEnvironment(process.env)
  const redisProbeConfig = resolveRedisProbeConfig(process.env)
  const mastraEnvironment = resolveMastraEnvironment(process.env)
  const updatedAt = new Date().toISOString()

  return [
    {
      description: '当前 API 进程运行环境。',
      key: 'app.node_env',
      mutable: false,
      scope: 'application',
      source: 'env',
      updatedAt,
      value: process.env.NODE_ENV ?? 'development',
    },
    {
      description: '当前 API 进程监听端口。',
      key: 'app.port',
      mutable: false,
      scope: 'application',
      source: 'env',
      updatedAt,
      value: process.env.PORT ?? '3001',
    },
    {
      description: '认证后端实现类型。',
      key: 'security.auth_provider',
      mutable: false,
      scope: 'security',
      source: 'static',
      updatedAt,
      value: 'better-auth',
    },
    {
      description: 'API 基础限流模式与通用配额。',
      key: 'security.rate_limit',
      mutable: false,
      scope: 'security',
      source: 'runtime',
      updatedAt,
      value: `${rateLimitEnvironment.enabled ? 'enabled' : 'disabled'}:${rateLimitEnvironment.generalMaxRequests}/${rateLimitEnvironment.generalWindowMs}ms`,
    },
    {
      description: '遥测提供方接线状态摘要。',
      key: 'observability.telemetry',
      mutable: false,
      scope: 'deploy',
      source: 'runtime',
      updatedAt,
      value: `sentry=${telemetryConfig.sentryDsn ? 'configured' : 'not-configured'};otlp=${telemetryConfig.otlpEndpoint ? 'configured' : 'not-configured'}`,
    },
    {
      description: 'AI runtime 默认模型。',
      key: 'ai.default_model',
      mutable: false,
      scope: 'ai',
      source: 'runtime',
      updatedAt,
      value: mastraEnvironment.defaultModel,
    },
    {
      description: 'Redis 健康探针配置状态。',
      key: 'deploy.redis_probe',
      mutable: false,
      scope: 'deploy',
      source: 'runtime',
      updatedAt,
      value: redisProbeConfig ? 'configured' : 'not-configured',
    },
  ]
}

/**
 * 提供系统配置管理页的最小只读 skeleton 列表。
 */
export async function listConfigs(
  input: ListConfigsInput | undefined,
): Promise<ConfigListResponse> {
  const resolvedInput = listConfigsInputSchema.parse(input)
  const normalizedSearch = resolvedInput.search?.trim().toLowerCase()
  const catalog = buildConfigCatalog().filter((item) => {
    if (resolvedInput.scope && item.scope !== resolvedInput.scope) {
      return false
    }

    if (!normalizedSearch) {
      return true
    }

    return [item.key, item.description, item.value].some((field) =>
      field.toLowerCase().includes(normalizedSearch),
    )
  })
  const pagedData = paginateArray(catalog, resolvedInput.page, resolvedInput.pageSize)

  return {
    data: pagedData,
    pagination: createPagination(resolvedInput.page, resolvedInput.pageSize, catalog.length),
  }
}

/**
 * 提供系统配置管理页的最小只读 skeleton 列表。
 */
export const configListProcedure = requireAnyPermission([
  { action: 'read', subject: 'Config' },
  { action: 'manage', subject: 'Config' },
  { action: 'manage', subject: 'all' },
])
  .route({
    method: 'GET',
    path: '/api/v1/system/config',
    tags: ['System:Config'],
    summary: 'List system runtime config summary',
    description: 'Returns a redacted runtime configuration summary for admin configuration views.',
  })
  .input(listConfigsInputSchema)
  .output(configListResponseSchema)
  .handler(async ({ input }) => listConfigs(input))
